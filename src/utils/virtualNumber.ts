const VIRTUAL_PREFIXES = ['899', '889', '898', '888'] as const;

const AVATAR_PALETTE = [
  '#00A884',
  '#027EB5',
  '#6B5CE7',
  '#C25975',
  '#D97706',
  '#0D9488',
  '#4F46E5',
] as const;

function randomDigit(): number {
  const buf = new Uint8Array(1);
  // Rejection sampling avoids modulo bias across 0..9
  while (true) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < 250) {
      return buf[0] % 10;
    }
  }
}

function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String(randomDigit());
  }
  return out;
}

/**
 * Generates a cryptographically random virtual phone number in Indonesian
 * WhatsApp-familiar format (+62 899-XXXX-XXXX) to mask the user's Google identity.
 */
export function generateRandomVirtualNumber(): string {
  const buf = new Uint8Array(1);
  globalThis.crypto.getRandomValues(buf);
  const prefix = VIRTUAL_PREFIXES[buf[0] % VIRTUAL_PREFIXES.length];
  const block1 = randomDigits(4);
  const block2 = randomDigits(4);
  return `+62 ${prefix}-${block1}-${block2}`;
}

export function normalizeVirtualDigits(virtualNumber: string): string {
  return virtualNumber.replace(/\D/g, '');
}

export function formatVirtualNumber(rawDigits: string): string {
  const digits = normalizeVirtualDigits(rawDigits);
  if (digits.startsWith('62') && digits.length >= 12) {
    const rest = digits.slice(2);
    return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7, 11)}`;
  }
  if (digits.length >= 10) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
}

export function generateVirtualAlias(virtualNumber: string): string {
  const digits = normalizeVirtualDigits(virtualNumber);
  const suffix = digits.slice(-4) || '0000';
  return `Anonim #${suffix}`;
}

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function sanitizeIdSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
}

export function createDeterministicChatId(uidA: string, uidB: string): string {
  const a = sanitizeIdSegment(uidA);
  const b = sanitizeIdSegment(uidB);
  const sorted = a < b ? [a, b] : [b, a];
  return `dm_${sorted[0]}_${sorted[1]}`.slice(0, 128);
}

export function createRandomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${sanitizeIdSegment(prefix)}_${hex}`.slice(0, 128);
}
