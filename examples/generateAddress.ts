import { hd } from '@ckb-lumos/lumos';
import dotenv from 'dotenv';
import { CkbUtils } from '../src';

dotenv.config();

const generateSecp256k1Address = async () => {
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
  const secp256k1Address = ckbUtils.encodeSecp256k1Address(publicKey);
  console.log(`Secp256k1 Address: ${secp256k1Address}`);

  const acpAddress = ckbUtils.encodeAcpAddress(publicKey);
  console.log('Acp Address:', acpAddress);
};

generateSecp256k1Address();
