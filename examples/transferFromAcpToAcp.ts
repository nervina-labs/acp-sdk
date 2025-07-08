import { hd } from '@ckb-lumos/lumos';
import dotenv from 'dotenv';
import {
  CkbUtils,
  constructTxSkeletonToTransferUSDIFromAcpToAcp,
  signAndSendTxWithSecp256k1Key,
} from '../src';

dotenv.config();

const transferUSDIToAcpFromAcpAddress = async () => {
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
  const toAcpAddress =
    'ckt1qq6pngwqn6e9vlm92th84rk0l4jp2h8lurchjmnwv8kq3rt5psf4vq0e4xk4rmg5jdkn8aams492a7jlg73ue0ghutfuy';

  const txSkeleton = await constructTxSkeletonToTransferUSDIFromAcpToAcp({
    ckbUtils,
    fromAcpAddress,
    toAcpAddress,
    usdiAmount: 0.3,
  });

  const txHash = await signAndSendTxWithSecp256k1Key(ckbUtils, txSkeleton, privateKey);

  console.log(`Transaction sent successfully! TxHash: ${txHash}`);
};

transferUSDIToAcpFromAcpAddress()
  .then(() => console.log('Transfer USDI between ACP addresses successfully.'))
  .catch((error) => console.error('Error transferring USDI:', error));
