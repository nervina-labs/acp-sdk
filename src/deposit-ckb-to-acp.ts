import { BI, Cell, helpers, OutPoint, Transaction } from '@ckb-lumos/lumos';
import { CKB_UNIT_SCALE, CkbUtils } from './utils';
import { TransactionSkeletonType } from '@ckb-lumos/lumos/helpers';

export interface DepositingToAcpParams {
  ckbUtils: CkbUtils;
  fromAddress: string;
  toAcpAddress: string;
  ckbAmount: number;
  acpOutPoint?: OutPoint;
  txSize?: number;
  feeRate?: number;
}

/**
 * Constructs a CKB transactionSkeleton to deposit CKB from a non-acp address to an ACP address.
 * Tx Structure:
 * [emptyInputs, toAcpCell] -> [toAcpOutput, changeOutput(optional)]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAddress - The address that will provide USDI and CKB(maybe) for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param ckbAmount - The amount of CKB to transfer.
 * @param txSize - The size of the transaction in bytes. If not provided, it will be calculated based on the current transaction.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transactionSkeleton.
 */
export const constructTxSkeletonToDepositCKBToAcpAddress = async ({
  ckbUtils,
  fromAddress,
  toAcpAddress,
  ckbAmount,
  acpOutPoint,
  txSize,
  feeRate = 1000,
}: DepositingToAcpParams): Promise<TransactionSkeletonType> => {
  const { balance: ckbBalance, emptyCells } =
    await ckbUtils.getCkbBalanceAndEmptyCells(fromAddress);
  const ckbAmountForTransfer = BI.from(ckbAmount * CKB_UNIT_SCALE);
  if (ckbBalance.lt(ckbAmountForTransfer)) {
    throw new Error(
      `CKB Insufficient balance, expected: ${ckbAmount} CKB, got: ${ckbBalance.div(CKB_UNIT_SCALE).toString()}, please deposit more CKB to the address: ${fromAddress}`,
    );
  }

  const toAcpCell = await ckbUtils.getAcpUsdiCell(toAcpAddress, acpOutPoint);
  if (!toAcpCell) {
    throw new Error(
      `No ACP cell found for address: ${toAcpAddress} ${acpOutPoint ? `with outPoint: ${JSON.stringify(acpOutPoint)}` : ''}`,
    );
  }

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ckbUtils.indexer });

  let inputsCapacity = BI.from(0);
  const inputCells: Cell[] = [];
  for (const cell of emptyCells) {
    inputsCapacity = inputsCapacity.add(BI.from(cell.cellOutput.capacity));
    inputCells.push(cell);
    if (inputsCapacity.gt(ckbAmountForTransfer)) {
      break;
    }
  }
  if (ckbBalance.lt(ckbAmountForTransfer)) {
    throw new Error(
      `Not enough CKB, expected: ${ckbAmount}, got: ${ckbBalance.div(CKB_UNIT_SCALE).toString()}.\nMore CKB is needed in the address: ${fromAddress}`,
    );
  }
  txSkeleton = txSkeleton.update('inputs', (inputs) => inputs.push(...inputCells, toAcpCell));

  const acpOutput = {
    cellOutput: {
      ...toAcpCell.cellOutput,
      capacity: `0x${BI.from(toAcpCell.cellOutput.capacity).add(ckbAmountForTransfer).toString(16)}`,
    },
    data: toAcpCell.data,
  };
  const changeOutput = {
    cellOutput: {
      lock: helpers.parseAddress(fromAddress),
      capacity: `0x${inputsCapacity.sub(ckbAmountForTransfer).toString(16)}`,
    },
    data: '0x',
  };
  txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(acpOutput, changeOutput));

  const cellDepList = [ckbUtils.getAcpCellDep(), ckbUtils.getUsdiCellDep()];
  if (ckbUtils.isSecp256k1Address(fromAddress)) {
    cellDepList.push(ckbUtils.getSecp256k1Dep());

    txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
      return witnesses.set(0, ckbUtils.generateSecp256k1EmptyWitness());
    });
  }
  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) => cellDeps.push(...cellDepList));

  // Calculate transaction fee and adjust change output capacity
  const txFee = ckbUtils.calculateTxFee(txSkeleton, feeRate, txSize);
  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    const changeOutput = outputs.get(outputs.size - 1)!;
    return outputs.set(outputs.size - 1, {
      ...changeOutput,
      cellOutput: {
        ...changeOutput.cellOutput,
        capacity: `0x${BI.from(changeOutput.cellOutput.capacity).sub(txFee).toString(16)}`,
      },
    });
  });

  return txSkeleton;
};

/**
 * Constructs a CKB transactionSkeleton to deposit CKB from a non-acp address to an ACP address.
 * Tx Structure:
 * [emptyInputs, toAcpCell] -> [toAcpOutput, changeOutput(optional)]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAddress - The address that will provide USDI and CKB(maybe) for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param ckbAmount - The amount of CKB to transfer.
 * @param txSize - Optional transaction size in bytes. If not provided, it will be calculated based on the current transaction.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transactionSkeleton.
 */
export const constructTxToDepositCKBToAcpAddress = async (
  params: DepositingToAcpParams,
): Promise<Transaction> => {
  const txSkeleton = await constructTxSkeletonToDepositCKBToAcpAddress(params);
  return helpers.createTransactionFromSkeleton(txSkeleton);
};
