import { commons, hd, helpers } from '@ckb-lumos/lumos';
import { TransactionSkeletonType } from '@ckb-lumos/helpers';
import { CkbUtils } from './utils';

export const signTxSkeletonWithSecp256k1Key = async (
  txSkeleton: TransactionSkeletonType,
  privateKey: string,
) => {
  const newTxSkeleton = commons.common.prepareSigningEntries(txSkeleton);
  const message = newTxSkeleton.get('signingEntries').get(0)?.message;
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    throw new Error(
      'The Secp256k1 private key should be a 66-character hex string prefixed with 0x.',
    );
  }
  const Sig = hd.key.signRecoverable(message!, privateKey);
  const tx = helpers.sealTransaction(newTxSkeleton, [Sig]);

  return tx;
};

export const signAndSendTxWithSecp256k1Key = async (
  ckbUtils: CkbUtils,
  txSkeleton: TransactionSkeletonType,
  privateKey: string,
) => {
  const tx = await signTxSkeletonWithSecp256k1Key(txSkeleton, privateKey);
  const txHash = await ckbUtils.rpc.sendTransaction(tx, 'passthrough');
  return txHash;
};
