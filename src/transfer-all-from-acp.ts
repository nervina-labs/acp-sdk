import { BI, Cell, helpers, Transaction } from '@ckb-lumos/lumos';
import * as codec from '@ckb-lumos/codec';
import { CkbUtils } from './utils';
import { TransactionSkeletonType } from '@ckb-lumos/lumos/helpers';

export interface TransferringAllParams {
  ckbUtils: CkbUtils;
  fromAcpAddress: string;
  toNonAcpAddress: string;
  feeRate?: number;
}
/**
 * Constructs a CKB transactionSkeleton to transfer all USDI from an ACP (Anyone-Can-Pay) address to a non-ACP address.
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAcpAddress - The source ACP address to transfer from.
 * @param toNonAcpAddress - The target address(NOT an ACP address) to transfer to.
 * @param feeRate - The fee rate to use for the transaction. Defaults to 1000 shannons/KB.
 * @returns A TransactionSkeletonType containing the transaction details.
 */
export const constructTxSkeletonToTransferAllUSDI = async ({
  ckbUtils,
  fromAcpAddress,
  toNonAcpAddress,
  feeRate = 1000,
}: TransferringAllParams): Promise<TransactionSkeletonType> => {
  const fromAcpCells = await ckbUtils.getAcpUsdiCells(fromAcpAddress);
  if (!fromAcpCells || fromAcpCells.length === 0) {
    throw new Error(`No ACP cell found for address: ${fromAcpAddress}`);
  }

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ckbUtils.indexer });

  // Collect USDI input cells from ACP address
  let usdiAmount = BI.from(0);
  let inputsCapacity = BI.from(0);
  const inputCells: Cell[] = [];
  for (const cell of fromAcpCells) {
    usdiAmount = usdiAmount.add(codec.number.Uint128LE.unpack(cell.data));
    inputsCapacity = inputsCapacity.add(BI.from(cell.cellOutput.capacity));
    inputCells.push(cell);
  }
  if (usdiAmount.isZero()) {
    throw new Error(`No USDI found in ACP address: ${fromAcpAddress}`);
  }
  txSkeleton = txSkeleton.update('inputs', (inputs) => inputs.push(...inputCells));

  const output = {
    cellOutput: {
      lock: helpers.parseAddress(toNonAcpAddress),
      type: ckbUtils.getUsdiTypeScript(),
      capacity: `0x${inputsCapacity.toString(16)}`,
    },
    data: `0x${Buffer.from(codec.number.Uint128LE.pack(usdiAmount)).toString('hex')}`,
  };
  txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(output));

  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
    cellDeps.push(ckbUtils.getAcpCellDep(), ckbUtils.getUsdiCellDep()),
  );

  txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
    return witnesses.set(0, ckbUtils.generateSecp256k1EmptyWitness());
  });

  const txFee = ckbUtils.calculateTxFee(txSkeleton, feeRate);
  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    return outputs.set(0, {
      cellOutput: {
        ...output.cellOutput,
        capacity: `0x${inputsCapacity.sub(txFee).toString(16)}`,
      },
      data: output.data,
    });
  });

  return txSkeleton;
};

/**
 * Constructs a CKB transaction to transfer all USDI from an ACP (Anyone-Can-Pay) address to a non-ACP address.
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAcpAddress - The source ACP address to transfer from.
 * @param toNonAcpAddress - The target address(NOT an ACP address) to transfer to.
 * @param feeRate - The fee rate to use for the transaction. Defaults to 1000 shannons/KB.
 * @returns A Transaction containing the transaction details.
 */
export const constructTxToTransferAllUSDI = async (
  params: TransferringAllParams,
): Promise<Transaction> => {
  const txSkeleton = await constructTxSkeletonToTransferAllUSDI(params);
  return helpers.createTransactionFromSkeleton(txSkeleton);
};
