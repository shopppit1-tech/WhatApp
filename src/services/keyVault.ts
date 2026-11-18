import type { EcPrivateKeyJwk, EcPublicKeyJwk } from '../types/chat';
import { generateIdentityKeyPair, type ExportedIdentityPair } from '../utils/crypto';

const KEYPAIR_STORAGE_PREFIX = 'sandiwa_ecdh_identity_v1_';

export async function getOrCreateIdentityKeyPair(uid: string): Promise<ExportedIdentityPair> {
  const storageKey = `${KEYPAIR_STORAGE_PREFIX}${uid}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as ExportedIdentityPair;
      if (
        parsed?.publicKey?.kty === 'EC' &&
        parsed?.publicKey?.crv === 'P-256' &&
        parsed?.privateKey?.d
      ) {
        return parsed;
      }
    }
  } catch {
    // Regenerate if storage is corrupt
  }

  const pair = await generateIdentityKeyPair();
  try {
    localStorage.setItem(storageKey, JSON.stringify(pair));
  } catch {
    // Continue with in-memory pair if storage is blocked
  }
  return pair;
}

export async function rotateIdentityKeyPair(uid: string): Promise<ExportedIdentityPair> {
  const pair = await generateIdentityKeyPair();
  try {
    localStorage.setItem(`${KEYPAIR_STORAGE_PREFIX}${uid}`, JSON.stringify(pair));
  } catch {
    // Ignore storage quota errors
  }
  return pair;
}

export function isValidEcPublicKey(pk: unknown): pk is EcPublicKeyJwk {
  if (!pk || typeof pk !== 'object') return false;
  const candidate = pk as Partial<EcPublicKeyJwk>;
  return (
    candidate.kty === 'EC' &&
    candidate.crv === 'P-256' &&
    typeof candidate.x === 'string' &&
    typeof candidate.y === 'string'
  );
}

export function isValidEcPrivateKey(pk: unknown): pk is EcPrivateKeyJwk {
  if (!isValidEcPublicKey(pk)) return false;
  return typeof (pk as Partial<EcPrivateKeyJwk>).d === 'string';
}
