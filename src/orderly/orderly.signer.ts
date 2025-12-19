// import { signAsync, getPublicKeyAsync } from '@noble/ed25519';
import bs58 from 'bs58';

export async function signOrderlyRequest({
  orderlyAccountId,
  orderlySecretKey, // Uint8Array
  method,
  path,
  body,
}: {
  orderlyAccountId: string;
  orderlySecretKey: Uint8Array;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  body?: any;
}) {
  const ed25519 = await import('@noble/ed25519');
  const { getPublicKeyAsync, signAsync } = ed25519;

  const timestamp = Date.now();
  let message = `${timestamp}${method.toUpperCase()}${path}`;

  if (body) {
    message += typeof body === 'string' ? body : JSON.stringify(body);
  }

  const signature = await signAsync(
    new TextEncoder().encode(message),
    orderlySecretKey,
  );

//   const sig = await signAsync(Buffer.from(message), orderlySecretKey);
//   const signatureBase64Url = Buffer.from(sig).toString('base64url');

  const publicKey = await getPublicKeyAsync(orderlySecretKey);

  return {
    orderlySignature: signature,
    headers: {
      'Content-Type':
        method === 'GET' || method === 'DELETE'
          ? 'application/x-www-form-urlencoded'
          : 'application/json',
      'orderly-account-id': orderlyAccountId,
      'orderly-timestamp': String(timestamp),
      'orderly-key': `ed25519:${bs58.encode(publicKey)}`,
      'orderly-signature': Buffer.from(signature).toString('base64url'),
    },
  };
}
