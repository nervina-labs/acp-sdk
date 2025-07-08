import { BI, Cell, helpers, Transaction } from '@ckb-lumos/lumos';
import * as codec from '@ckb-lumos/codec';
import { CkbUtils, USDI_DECIMALS } from './utils';
import { TransactionSkeletonType } from '@ckb-lumos/lumos/helpers';

export interface TransferringToAcpParams {
  ckbUtils: CkbUtils;
  fromSecp256k1Address: string;
  toAcpAddress: string;
  usdiAmount: number;
  feeRate?: number;
}

/**
 * Constructs a CKB transactionSkeleton to transfer USDI from a secp256k1 address to an ACP (Anyone-Can-Pay) address.
 * Tx Structure:
 * [secp256k1UsdiInputs, secp256k1EmptyInputs(optional), toAcpCell] -> [toAcpUsdiOutput, changeUsdiOutput, changeCkbOutput(optional)]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromSecp256k1Address - The secp256k1 address that will provide USDI and CKB(maybe) for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param usdiAmount - The amount of USDI to transfer.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transactionSkeleton.
 */
export const constructTxSkeletonToTransferUSDIToAcpAddress = async ({
  ckbUtils,
  fromSecp256k1Address,
  toAcpAddress,
  usdiAmount,
  feeRate = 1000,
}: TransferringToAcpParams): Promise<TransactionSkeletonType> => {
  const { balance: usdiBalance, cells: usdiCells } =
    await ckbUtils.getUSDIBalanceAndCells(fromSecp256k1Address);
  const usdiAmountForTransfer = BI.from(usdiAmount * USDI_DECIMALS);
  if (usdiBalance.lt(usdiAmountForTransfer)) {
    throw new Error(
      `USDI Insufficient balance, expected: ${usdiAmount} USDI, got: ${usdiBalance.div(USDI_DECIMALS).toString()}, please deposit more USDI to the Secp256k1 address: ${fromSecp256k1Address}`,
    );
  }

  const toAcpCell = await ckbUtils.getAcpUsdiCell(toAcpAddress);
  if (!toAcpCell) {
    throw new Error(`No ACP cell found for address: ${toAcpAddress}`);
  }

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ckbUtils.indexer });

  // Collect USDI input cells and check if we need an empty cell for transaction fee
  let usdiSupply = BI.from(0);
  let usdiInputsCapacity = BI.from(0);
  let needEmptyCell = true;
  const inputCells: Cell[] = [];
  for (const cell of usdiCells) {
    usdiSupply = usdiSupply.add(codec.number.Uint128LE.unpack(cell.data));
    usdiInputsCapacity = usdiInputsCapacity.add(BI.from(cell.cellOutput.capacity));
    inputCells.push(cell);
    // Check if the cell has enough capacity for transaction fee, if it does, we can skip adding an empty cell
    if (BI.from(cell.cellOutput.capacity).gt(helpers.minimalCellCapacityCompatible(cell))) {
      needEmptyCell = false;
    }
    if (usdiSupply.gt(usdiAmountForTransfer)) {
      break;
    }
  }
  if (usdiSupply.lt(usdiAmountForTransfer)) {
    throw new Error(
      `Not enough USDI, expected: ${usdiAmount}, got: ${usdiSupply.div(BI.from(USDI_DECIMALS)).toString()}.\nMore USDI is needed in the address: ${fromSecp256k1Address}`,
    );
  }
  if (needEmptyCell) {
    const { emptyCells } = await ckbUtils.getCkbBalanceAndEmptyCells(fromSecp256k1Address);
    if (emptyCells.length === 0 || !emptyCells) {
      throw new Error('No empty cell found with enough capacity for transaction fee.');
    }
    inputCells.push(emptyCells[0]);
  }
  txSkeleton = txSkeleton.update('inputs', (inputs) => inputs.push(...inputCells, toAcpCell));

  const toAcpUsdiAmount = codec.number.Uint128LE.unpack(toAcpCell.data).add(usdiAmountForTransfer);
  const acpOutput = {
    cellOutput: toAcpCell.cellOutput,
    data: `0x${Buffer.from(codec.number.Uint128LE.pack(toAcpUsdiAmount)).toString('hex')}`,
  };
  const changeUsdiOutput = {
    cellOutput: {
      lock: helpers.parseAddress(fromSecp256k1Address),
      type: ckbUtils.getUsdiTypeScript(),
      capacity: `0x${usdiInputsCapacity.toString(16)}`,
    },
    data: `0x${Buffer.from(codec.number.Uint128LE.pack(usdiSupply.sub(usdiAmountForTransfer))).toString('hex')}`,
  };
  txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(acpOutput, changeUsdiOutput));
  if (needEmptyCell) {
    const changeOutput = inputCells[inputCells.length - 1];
    txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(changeOutput));
  }

  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
    cellDeps.push(ckbUtils.getSecp256k1Dep(), ckbUtils.getAcpCellDep(), ckbUtils.getUsdiCellDep()),
  );

  txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
    return witnesses.set(0, ckbUtils.generateSecp256k1EmptyWitness());
  });

  // Calculate transaction fee and adjust change output capacity
  const txFee = ckbUtils.calculateTxFee(txSkeleton, feeRate);
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
 * Constructs a CKB transaction to transfer USDI from a secp256k1 address to an ACP (Anyone-Can-Pay) address.
 * Tx Structure:
 * [toAcpCell, secp256k1UsdiInputs, secp256k1EmptyInputs(optional)] -> [toAcpUsdiOutput, changeUsdiOutput, changeCkbOutput(optional)]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromSecp256k1Address - The secp256k1 address that will provide USDI and CKB(maybe) for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param usdiAmount - The amount of USDI to transfer.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transaction.
 */
export const constructTxToTransferUSDIToAcpAddress = async (
  params: TransferringToAcpParams,
): Promise<Transaction> => {
  const txSkeleton = await constructTxSkeletonToTransferUSDIToAcpAddress(params);
  return helpers.createTransactionFromSkeleton(txSkeleton);
};

export interface TransferringFromAcpToAcpParams {
  ckbUtils: CkbUtils;
  fromAcpAddress: string;
  toAcpAddress: string;
  usdiAmount: number;
  feeRate?: number;
}
/**
 * Constructs a CKB transactionSkeleton to transfer USDI from a secp256k1 address to an ACP (Anyone-Can-Pay) address.
 * Tx Structure: [toAcpCell, fromAcpUsdiInputs] -> [toAcpUsdiOutput, changeUsdiOutput]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAcpAddress - The secp256k1 address that will provide USDI and CKB(maybe) for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param usdiAmount - The amount of USDI to transfer.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transactionSkeleton.
 */
export const constructTxSkeletonToTransferUSDIFromAcpToAcp = async ({
  ckbUtils,
  fromAcpAddress,
  toAcpAddress,
  usdiAmount,
  feeRate = 1000,
}: TransferringFromAcpToAcpParams): Promise<TransactionSkeletonType> => {
  const { balance: usdiBalance, cells: usdiCells } =
    await ckbUtils.getUSDIBalanceAndCells(fromAcpAddress);
  const usdiAmountForTransfer = BI.from(usdiAmount * USDI_DECIMALS);
  if (usdiBalance.lt(usdiAmountForTransfer)) {
    throw new Error(
      `USDI Insufficient balance, expected: ${usdiAmount} USDI, got: ${usdiBalance.div(USDI_DECIMALS).toString()}, please deposit more USDI to the ACP address: ${fromAcpAddress}`,
    );
  }

  const toAcpCell = await ckbUtils.getAcpUsdiCell(toAcpAddress);
  if (!toAcpCell) {
    throw new Error(`No ACP cell found for address: ${toAcpAddress}`);
  }

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: ckbUtils.indexer });

  // Collect USDI input cells and check if we need an empty cell for transaction fee
  let usdiSupply = BI.from(0);
  let usdiInputsCapacity = BI.from(0);
  const inputCells: Cell[] = [];
  for (const cell of usdiCells) {
    usdiSupply = usdiSupply.add(codec.number.Uint128LE.unpack(cell.data));
    usdiInputsCapacity = usdiInputsCapacity.add(BI.from(cell.cellOutput.capacity));
    inputCells.push(cell);
    if (usdiSupply.gt(usdiAmountForTransfer)) {
      break;
    }
  }
  if (usdiSupply.lt(usdiAmountForTransfer)) {
    throw new Error(
      `Not enough USDI, expected: ${usdiAmount}, got: ${usdiSupply.div(BI.from(USDI_DECIMALS)).toString()}.\nMore USDI is needed in the address: ${fromAcpAddress}`,
    );
  }
  txSkeleton = txSkeleton.update('inputs', (inputs) => inputs.push(...inputCells, toAcpCell));

  const toAcpUsdiAmount = codec.number.Uint128LE.unpack(toAcpCell.data).add(usdiAmountForTransfer);
  const acpOutput = {
    cellOutput: toAcpCell.cellOutput,
    data: `0x${Buffer.from(codec.number.Uint128LE.pack(toAcpUsdiAmount)).toString('hex')}`,
  };
  const changeUsdiOutput = {
    cellOutput: {
      lock: helpers.parseAddress(fromAcpAddress),
      type: ckbUtils.getUsdiTypeScript(),
      capacity: `0x${usdiInputsCapacity.toString(16)}`,
    },
    data: `0x${Buffer.from(codec.number.Uint128LE.pack(usdiSupply.sub(usdiAmountForTransfer))).toString('hex')}`,
  };
  txSkeleton = txSkeleton.update('outputs', (outputs) => outputs.push(acpOutput, changeUsdiOutput));

  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) =>
    cellDeps.push(ckbUtils.getSecp256k1Dep(), ckbUtils.getAcpCellDep(), ckbUtils.getUsdiCellDep()),
  );

  txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
    return witnesses.set(0, ckbUtils.generateSecp256k1EmptyWitness());
  });

  // Calculate transaction fee and adjust change output capacity
  const txFee = ckbUtils.calculateTxFee(txSkeleton, feeRate);
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
 * Constructs a CKB transaction to transfer USDI from a secp256k1 address to an ACP (Anyone-Can-Pay) address.
 * Tx Structure: [toAcpCell, fromAcpUsdiInputs] -> [toAcpUsdiOutput, changeUsdiOutput]
 * @param ckbUtils - An instance of CkbUtils to interact with CKB node and indexer.
 * @param fromAcpAddress - The ACP address that will provide USDI for the transaction.
 * @param toAcpAddress - The ACP address to transfer USDI to.
 * @param usdiAmount - The amount of USDI to transfer.
 * @param feeRate - The fee rate in Shannons per kilobyte for the transaction. Defaults to 1000 shannons/KB.
 * @returns The constructed CKB transaction.
 */
export const constructTxToTransferUSDIFromAcpToAcp = async (
  params: TransferringFromAcpToAcpParams,
): Promise<Transaction> => {
  const txSkeleton = await constructTxSkeletonToTransferUSDIFromAcpToAcp(params);
  return helpers.createTransactionFromSkeleton(txSkeleton);
};
