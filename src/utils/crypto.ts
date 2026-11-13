import type { EcPrivateKeyJwk, EcPublicKeyJwk } from '../types/chat';

const E2EE_ALGO = 'ECDH-P256-AES-256-GCM' as const;
const HKDF_INFO = 'SandiWA-E2EE-v1';

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface ExportedIdentityPair {
  publicKey: EcPublicKeyJwk;
  privateKey: EcPrivateKeyJwk;
}

export async function generateIdentityKeyPair(): Promise<ExportedIdentityPair> {
  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const rawPub = await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const rawPriv = await globalThis.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  if (!rawPub.x || !rawPub.y || !rawPriv.d || !rawPriv.x || !rawPriv.y) {
    throw new Error('Gagal menghasilkan pasangan kunci ECDH P-256.');
  }

  return {
    publicKey: {
      kty: 'EC',
      crv: 'P-256',
      x: rawPub.x,
      y: rawPub.y,
    },
    privateKey: {
      kty: 'EC',
      crv: 'P-256',
      x: rawPriv.x,
      y: rawPriv.y,
      d: rawPriv.d,
    },
  };
}

export async function importPublicKeyJwk(jwk: EcPublicKeyJwk): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importPrivateKeyJwk(jwk: EcPrivateKeyJwk): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, ext: true },
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derives an AES-256-GCM symmetric key from ECDH P-256 shared secret + HKDF-SHA-256.
 */
export async function deriveSharedAesKey(
  myPrivateKeyJwk: EcPrivateKeyJwk,
  peerPublicKeyJwk: EcPublicKeyJwk,
  contextId: string
): Promise<CryptoKey> {
  const [privKey, pubKey] = await Promise.all([
    importPrivateKeyJwk(myPrivateKeyJwk),
    importPublicKeyJwk(peerPublicKeyJwk),
  ]);

  const sharedBits = await globalThis.crypto.subtle.deriveBits(
    { name: 'ECDH', public: pubKey },
    privKey,
    256
  );

  const hkdfBaseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  const encoder = new TextEncoder();
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(contextId),
      info: encoder.encode(HKDF_INFO),
    },
    hkdfBaseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a deterministic AES-256-GCM key for multi-member group rooms using
 * the creator's ECDH public/private binding or shared group key seed.
 */
export async function deriveGroupAesKey(secretSeed: string, chatId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secretSeed),
    'HKDF',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(chatId),
      info: encoder.encode('SandiWA-Group-E2EE-v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  ciphertext: string;
  iv: string;
  aad: string;
  algo: typeof E2EE_ALGO;
}

export async function encryptTextPayload(
  sharedKey: CryptoKey,
  plaintext: string,
  aad: string
): Promise<EncryptedEnvelope> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const encoder = new TextEncoder();
  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
      additionalData: encoder.encode(aad),
      tagLength: 128,
    },
    sharedKey,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: toBase64(new Uint8Array(encryptedBuffer)),
    iv: toBase64(iv),
    aad,
    algo: E2EE_ALGO,
  };
}

export async function decryptTextPayload(
  sharedKey: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
  aad: string
): Promise<string> {
  const ciphertextBytes = fromBase64(ciphertextB64);
  const ivBytes = fromBase64(ivB64);
  const encoder = new TextEncoder();

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes.buffer as ArrayBuffer,
      additionalData: encoder.encode(aad),
      tagLength: 128,
    },
    sharedKey,
    ciphertextBytes.buffer as ArrayBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Computes a WhatsApp-style 60-digit Safety Number (12 groups of 5 digits)
 * symmetrically from both participants' ECDH P-256 public keys.
 */
export async function computeSafetyNumber(
  keyA: EcPublicKeyJwk,
  keyB: EcPublicKeyJwk,
  virtualNumA: string,
  virtualNumB: string
): Promise<string> {
  const reprA = `${keyA.x}:${keyA.y}:${virtualNumA}`;
  const reprB = `${keyB.x}:${keyB.y}:${virtualNumB}`;
  const ordered = reprA < reprB ? `${reprA}|${reprB}` : `${reprB}|${reprA}`;

  const encoder = new TextEncoder();
  let digest = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(ordered))
  );

  // Stretch digest once more to gather 30+ bytes for 12 five-digit blocks
  const digest2 = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', digest)
  );
  const combined = new Uint8Array(digest.length + digest2.length);
  combined.set(digest, 0);
  combined.set(digest2, digest.length);

  const blocks: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const offset = i * 4;
    const val =
      ((combined[offset] << 24) |
        (combined[offset + 1] << 16) |
        (combined[offset + 2] << 8) |
        combined[offset + 3]) >>>
      0;
    blocks.push(String(val % 100000).padStart(5, '0'));
  }

  return blocks.join(' ');
}

export async function computeKeyFingerprint(key: EcPublicKeyJwk): Promise<string> {
  const encoder = new TextEncoder();
  const hash = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(`${key.kty}:${key.crv}:${key.x}:${key.y}`))
  );
  return Array.from(hash.slice(0, 8), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}
