import {
  BI,
  BIish,
  Cell,
  CellDep,
  Indexer,
  RPC,
  config,
  helpers,
  hd,
  Script,
  OutPoint,
} from '@ckb-lumos/lumos';
import { blockchain } from '@ckb-lumos/base';
import { number, bytes } from '@ckb-lumos/codec';
import { createTransactionFromSkeleton, TransactionSkeletonType } from '@ckb-lumos/helpers';

// Minimum Capacity: JoyID lock(55 bytes) + UDT type script(65 bytes) + UDT cell data(16 bytes) + Cell capacity(8 bytes) = 144 bytes
const ACP_MIN_CAPACITY = 144;
const ACP_MIN_HEX_CAPACITY = '0x35a4e9000'; // 144 * 10 ** 8 in hexadecimal
// Default capacity for ACP cells in CKB(0.01 CKB for transaction fee)
export const ACP_DEFAULT_CAPACITY = ACP_MIN_CAPACITY + 0.01;

export const USDI_DECIMALS = 10 ** 6; // USDI is in 6 decimal places
export const CKB_UNIT_SCALE = 10 ** 8; // CKB is in 8 decimal places

const USDI_TESTNET_TYPE_SCRIPT: Script = {
  codeHash: '0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037',
  hashType: 'type',
  args: '0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f',
};
const USDI_TESTNET_CELL_DEP: CellDep = {
  outPoint: {
    txHash: '0xaec423c2af7fe844b476333190096b10fc5726e6d9ac58a9b71f71ffac204fee',
    index: '0x0',
  },
  depType: 'code',
};
const USDI_MAINNET_TYPE_SCRIPT: Script = {
  codeHash: '0xbfa35a9c38a676682b65ade8f02be164d48632281477e36f8dc2f41f79e56bfc',
  hashType: 'type',
  args: '0xd591ebdc69626647e056e13345fd830c8b876bb06aa07ba610479eb77153ea9f',
};
const USDI_MAINNET_CELL_DEP: CellDep = {
  outPoint: {
    txHash: '0xf6a5eef65101899db9709c8de1cc28f23c1bee90d857ebe176f6647ef109e20d',
    index: '0x0',
  },
  depType: 'code',
};

export interface CkbUtilParams {
  ckbRpcUrl: string;
  ckbIndexerUrl: string;
  isMainnet: boolean;
}

export class CkbUtils {
  private isMainnet: boolean;
  public rpc: RPC;
  public indexer: Indexer;
  public lumosConfig: typeof config.TESTNET | typeof config.MAINNET;

  public constructor(params: CkbUtilParams) {
    this.isMainnet = params.isMainnet;
    this.rpc = new RPC(params.ckbRpcUrl);
    this.indexer = new Indexer(params.ckbIndexerUrl, params.ckbRpcUrl);
    this.lumosConfig = params.isMainnet ? config.MAINNET : config.TESTNET;
    config.initializeConfig(this.lumosConfig);
  }

  _encodePublicKeyHash = (publicKey: string): string => {
    if (!publicKey.startsWith('0x') || publicKey.length !== 68) {
      throw new Error(
        'The Secp256k1 public key should be a 68-character hex string prefixed with 0x.',
      );
    }
    return hd.key.publicKeyToBlake160(publicKey);
  };

  encodeSecp256k1Address = (publicKey: string): string => {
    const secp256k1Lock = {
      codeHash: this.lumosConfig.SCRIPTS.SECP256K1_BLAKE160.CODE_HASH,
      hashType: this.lumosConfig.SCRIPTS.SECP256K1_BLAKE160.HASH_TYPE,
      args: this._encodePublicKeyHash(publicKey),
    };
    return helpers.encodeToAddress(secp256k1Lock, { config: this.lumosConfig });
  };

  encodeAcpAddress = (publicKey: string): string => {
    const acpLock = {
      codeHash: this.lumosConfig.SCRIPTS.ANYONE_CAN_PAY.CODE_HASH,
      hashType: this.lumosConfig.SCRIPTS.ANYONE_CAN_PAY.HASH_TYPE,
      args: this._encodePublicKeyHash(publicKey),
    };
    return helpers.encodeToAddress(acpLock, { config: this.lumosConfig });
  };

  hasAcpCells = async (acpAddress: string): Promise<boolean> => {
    try {
      const lock = helpers.parseAddress(acpAddress);
      // Verify this is an ACP address
      if (
        lock.codeHash !== this.lumosConfig.SCRIPTS.ANYONE_CAN_PAY.CODE_HASH &&
        lock.hashType !== 'type'
      ) {
        throw new Error('The provided address is not an ACP address');
      }
      const collector = this.indexer.collector({
        lock,
        type: this.getUsdiTypeScript(),
      });
      // Check if there's at least one cell
      for await (const _ of collector.collect()) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking ACP cells:', error);
      return false;
    }
  };

  getAcpCellDep = (): CellDep => {
    const acpDep = this.lumosConfig.SCRIPTS.ANYONE_CAN_PAY;
    return {
      depType: acpDep.DEP_TYPE,
      outPoint: {
        txHash: acpDep.TX_HASH,
        index: acpDep.INDEX,
      },
    };
  };

  isSecp256k1Address = (address: string): boolean => {
    try {
      const lock = helpers.parseAddress(address);
      return (
        lock.codeHash === this.lumosConfig.SCRIPTS.SECP256K1_BLAKE160.CODE_HASH &&
        lock.hashType === this.lumosConfig.SCRIPTS.SECP256K1_BLAKE160.HASH_TYPE
      );
    } catch (error) {
      console.error('Error checking if address is Secp256k1:', error);
      return false;
    }
  };

  getUsdiTypeScript = (): Script =>
    this.isMainnet ? USDI_MAINNET_TYPE_SCRIPT : USDI_TESTNET_TYPE_SCRIPT;

  getUsdiCellDep = (): CellDep => (this.isMainnet ? USDI_MAINNET_CELL_DEP : USDI_TESTNET_CELL_DEP);

  getSecp256k1Dep = (): CellDep => {
    const secp256k1Dep = this.lumosConfig.SCRIPTS.SECP256K1_BLAKE160;
    return {
      depType: secp256k1Dep.DEP_TYPE,
      outPoint: {
        txHash: secp256k1Dep.TX_HASH,
        index: secp256k1Dep.INDEX,
      },
    };
  };

  getCkbBalanceAndEmptyCells = async (
    address: string,
  ): Promise<{ balance: BI; emptyCells: Cell[] }> => {
    const collector = this.indexer.collector({
      lock: helpers.parseAddress(address),
    });

    let balance = BI.from(0);
    const emptyCells: Cell[] = [];
    for await (const cell of collector.collect()) {
      balance = balance.add(BI.from(cell.cellOutput.capacity));
      if (!cell.cellOutput.type) {
        emptyCells.push(cell);
      }
    }

    return { balance, emptyCells };
  };

  getUSDIBalanceAndCells = async (address: string): Promise<{ balance: BI; cells: Cell[] }> => {
    const collector = this.indexer.collector({
      lock: helpers.parseAddress(address),
      type: this.getUsdiTypeScript(),
    });

    let balance = BI.from(0);
    const cells: Cell[] = [];
    for await (const cell of collector.collect()) {
      balance = balance.add(number.Uint128LE.unpack(cell.data));
      cells.push(cell);
    }

    return { balance, cells };
  };

  // Retrieves a single ACP cell for the given address and if the acpOutPoint is provided, it will return that specific cell.
  getAcpUsdiCell = async (address: string, acpOutPoint?: OutPoint): Promise<Cell | null> => {
    const collector = this.indexer.collector({
      lock: helpers.parseAddress(address),
      type: this.getUsdiTypeScript(),
      outputCapacityRange: [ACP_MIN_HEX_CAPACITY, '0xFFFFFFFFFFFFFFFF'],
    });
    if (acpOutPoint) {
      const { cell } = await this.rpc.getLiveCell(acpOutPoint, true);
      if (!cell) {
        throw new Error(
          `No ACP cell found for address: ${address} with outPoint: ${JSON.stringify(acpOutPoint)}`,
        );
      }
      return {
        cellOutput: cell.output,
        data: cell.data.content,
        outPoint: acpOutPoint,
      } as Cell;
    }
    for await (const cell of collector.collect()) {
      return cell;
    }
    return null;
  };

  getAcpUsdiCells = async (address: string): Promise<Cell[]> => {
    const collector = this.indexer.collector({
      lock: helpers.parseAddress(address),
      type: this.getUsdiTypeScript(),
      outputCapacityRange: [ACP_MIN_HEX_CAPACITY, '0xFFFFFFFFFFFFFFFF'],
    });
    const cells: Cell[] = [];
    for await (const cell of collector.collect()) {
      cells.push(cell);
    }
    return cells;
  };

  generateSecp256k1EmptyWitness = () => {
    const witnessArgs = { lock: '0x' + '00'.repeat(65) };
    const witness = bytes.hexify(blockchain.WitnessArgs.pack(witnessArgs));
    return witness;
  };

  _getTransactionSize = (txSkeleton: TransactionSkeletonType): number => {
    const tx = createTransactionFromSkeleton(txSkeleton);
    const serializedTx = blockchain.Transaction.pack(tx);
    // 4 is serialized offset bytesize
    const size = serializedTx.byteLength + 4;
    return size;
  };

  _calculateFeeCompatible = (size: number, feeRate: BIish): BI => {
    const ratio = BI.from(1000);
    const base = BI.from(size).mul(feeRate);
    const fee = base.div(ratio);
    if (fee.mul(ratio).lt(base)) {
      return fee.add(1);
    }
    return BI.from(fee);
  };

  calculateTxFee = (txSkeleton: TransactionSkeletonType, feeRate: number, txSize?: number): BI => {
    const size = txSize ?? this._getTransactionSize(txSkeleton);
    return this._calculateFeeCompatible(size, feeRate);
  };
}
