import { hd } from '@ckb-lumos/lumos';
import dotenv from 'dotenv';
import {
  CkbUtils,
  constructTxSkeletonToDepositCKBToAcpAddress,
  signAndSendTxWithSecp256k1Key,
} from '../src';

dotenv.config();

const depositCKBToAcpFromSecp256k1Address = async () => {
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
  const fromSecp256k1Address = ckbUtils.encodeSecp256k1Address(publicKey);
  const toAcpAddress = ckbUtils.encodeAcpAddress(publicKey);

  const txSkeleton = await constructTxSkeletonToDepositCKBToAcpAddress({
    ckbUtils,
    fromAddress: fromSecp256k1Address,
    toAcpAddress,
    ckbAmount: 10,
    // If you want to deposit to a specific ACP cell, you can provide the outPoint of that cell.
    // If you don't provide it, the SDK will find an existing ACP cell for you.
    // acpOutPoint: {
    //   txHash: '0xf0f564c0abbedadbbca7f2416938f0d9acc28f269122e6843f5e2464819ba271',
    //   index: '0x0',
    // },
  });

  const txHash = await signAndSendTxWithSecp256k1Key(ckbUtils, txSkeleton, privateKey);

  console.log(`Transaction sent successfully! TxHash: ${txHash}`);
};

depositCKBToAcpFromSecp256k1Address()
  .then(() => console.log('Deposit CKB to Acp address successfully.'))
  .catch((error) => console.error('Error depositing CKB:', error));
