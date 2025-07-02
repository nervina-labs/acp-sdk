import { BI, Cell, commons, helpers, Transaction } from '@ckb-lumos/lumos';
import { ACP_DEFAULT_CAPACITY, CkbUtils } from './utils';
import { TransactionSkeletonType } from '@ckb-lumos/lumos/helpers';

export interface CreatingAcpCellsParams {
  ckbUtils: CkbUtils;
  fromSecp256k1Address: string;
  acpAddress: string;
  count: number;
  acpCapacity: number;
  feeRate: number;
}

/**
 * Constructs a CKB transaction to create ACP (Anyone-Can-Pay) cells using a secp256k1 address to provide CKB.
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromSecp256k1Address - The secp256k1 address that will provide CKB for the transaction.
 * @param acpAddress - The ACP address where the new cells will be created.
 * @param count - The number of ACP cells to create. Defaults to 1.
 * @param acpCapacity - The capacity of each ACP cell in CKB. Defaults to ACP_DEFAULT_CAPACITY (144.01 CKB).
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transactionSkeleton.
 */
export const constructTxSkeletonToCreateAcpCells = async ({
  ckbUtils,
  fromSecp256k1Address,
  acpAddress,
  count = 1,
  acpCapacity = ACP_DEFAULT_CAPACITY,
  feeRate = 1000,
}: CreatingAcpCellsParams): Promise<TransactionSkeletonType> => {
  const singleCapacity = BI.from(acpCapacity * 10 ** 8);
  const expectedCapacities = singleCapacity.mul(BI.from(count));

  const providerLock = helpers.parseAddress(fromSecp256k1Address);
  const acpLock = helpers.parseAddress(acpAddress);

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ckbUtils.indexer });

  // Collect empty input cells from the secp256k1 address
  let inputsCapacities = BI.from(0);
  const inputCells: Cell[] = [];
  const { emptyCells } = await ckbUtils.getCkbBalanceAndEmptyCells(fromSecp256k1Address);
  for (const cell of emptyCells) {
    inputsCapacities = inputsCapacities.add(BI.from(cell.cellOutput.capacity));
    inputCells.push(cell);
    if (inputsCapacities.gt(expectedCapacities)) {
      break;
    }
  }
  if (inputsCapacities.lt(expectedCapacities)) {
    throw new Error(
      `Not enough capacity, expected: ${expectedCapacities.div(BI.from(10 ** 8))}, got: ${inputsCapacities.div(BI.from(10 ** 8))}.\n 
      More CKB is needed in the address: ${fromSecp256k1Address}`,
    );
  }
  txSkeleton = txSkeleton.update('inputs', (inputs) => inputs.push(...inputCells));

  // Construct ACP outputs with the specified capacity and count
  const acpOutputs = Array(count).fill({
    cellOutput: {
      lock: acpLock,
      type: ckbUtils.getUsdiTypeScript(),
      capacity: `0x${singleCapacity.toString(16)}`,
    },
    data: `0x${'00'.repeat(16)}`, // 16 bytes for Uint128LE, amount = 0
  });
  const changeOutput = {
    cellOutput: {
      lock: providerLock,
      capacity: `0x${inputsCapacities.sub(expectedCapacities).toString(16)}`,
    },
    data: '0x',
  };
  txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(...acpOutputs, changeOutput));

  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
    cellDeps.push(ckbUtils.getSecp256k1Dep(), ckbUtils.getUsdiCellDep()),
  );

  txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
    return witnesses.set(0, ckbUtils.generateSecp256k1EmptyWitness());
  });

  const txFee = ckbUtils.calculateTxFee(txSkeleton, feeRate); // Assuming a fee rate of 1000 shannons/KB
  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    return outputs.set(outputs.size - 1, {
      ...changeOutput,
      cellOutput: {
        ...changeOutput.cellOutput,
        capacity: `0x${BI.from(changeOutput.cellOutput.capacity).sub(txFee).toString(16)}`,
      },
    });
  });

  txSkeleton = commons.common.prepareSigningEntries(txSkeleton);

  return txSkeleton;
};

/**
 * Constructs a CKB transaction to create ACP (Anyone-Can-Pay) cells using a secp256k1 address to provide CKB.
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromSecp256k1Address - The secp256k1 address that will provide CKB for the transaction.
 * @param acpAddress - The ACP address where the new cells will be created.
 * @param count - The number of ACP cells to create. Defaults to 1.
 * @param acpCapacity - The capacity of each ACP cell in CKB. Defaults to ACP_DEFAULT_CAPACITY (144.01 CKB).
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transaction.
 */
export const constructTxToCreateAcpCells = async (
  params: CreatingAcpCellsParams,
): Promise<Transaction> => {
  const txSkeleton = await constructTxSkeletonToCreateAcpCells(params);
  return helpers.createTransactionFromSkeleton(txSkeleton);
};
