import { hd } from "@ckb-lumos/lumos";
import dotenv from 'dotenv';
import { CkbUtils, constructTxSkeletonToTransferAllUSDI, signAndSendTxWithSecp256k1Key } from "../src";

dotenv.config();

const transferUSDIToAcpFromSecp256k1Address = async () => {
  const ckbUtils = new CkbUtils({
    ckbRpcUrl: 'https://testnet.ckb.dev/rpc',
    ckbIndexerUrl: 'https://testnet.ckb.dev/indexer',
    isMainnet: false,
  });
  const privateKey = process.env.EXAMPLE_CKB_SECP256K1_PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
    throw new Error(
      'The Secp256k1 private key should be a 66-character hex string prefixed with 0x.',
    );
  }
  const publicKey = hd.key.privateToPublic(privateKey);
  const fromAcpAddress = ckbUtils.encodeAcpAddress(publicKey);
  const joyIDAddress =
    'ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq8dsj68qt7k5gvvnr200y6xk5tp5wx3xh559cq9j';

  const txSkeleton = await constructTxSkeletonToTransferAllUSDI({
    ckbUtils,
    fromAcpAddress,
    toNonAcpAddress: joyIDAddress,
  });

  const txHash = await signAndSendTxWithSecp256k1Key(ckbUtils, txSkeleton, privateKey);

  console.log(`Transaction sent successfully! TxHash: ${txHash}`);
}

transferUSDIToAcpFromSecp256k1Address()
  .then(() => console.log('Transfer USDI to Acp address successfully.'))
  .catch((error) => console.error('Error transferring USDI:', error));