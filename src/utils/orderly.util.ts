// import { utils, getPublicKey } from '@noble/ed25519';
import bs58 from 'bs58';

export async function generateOrderlyKeypair() {
  const ed25519 = await import('@noble/ed25519');
  const { utils, getPublicKey } = ed25519;

  const secretKey = utils.randomSecretKey(); // Uint8Array (32 bytes)
  const publicKey = getPublicKey(secretKey);

  return {
    publicKeyBase58: bs58.encode(publicKey),
    secretKeyBase58: bs58.encode(secretKey),
  };
}
