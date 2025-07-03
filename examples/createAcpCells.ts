import { hd } from "@ckb-lumos/lumos";
import dotenv from 'dotenv';
import { CkbUtils, constructTxSkeletonToCreateAcpCells, signAndSendTxWithSecp256k1Key } from "../src";

dotenv.config();

const createAcpCells = async () => {
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

  const txSkeleton = await constructTxSkeletonToCreateAcpCells({
    ckbUtils,
    fromSecp256k1Address,
    toAcpAddress,
    count: 1,
  });

  const txHash = await signAndSendTxWithSecp256k1Key(ckbUtils, txSkeleton, privateKey);

  console.log(`Transaction sent successfully! TxHash: ${txHash}`);
}

createAcpCells()
  .then(() => console.log("Acp cells created successfully."))
  .catch((error) => console.error("Error creating ACP cells:", error));