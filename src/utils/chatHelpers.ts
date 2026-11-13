export function formatTimeClock(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatChatListTime(ms: number, nowMs = Date.now()): string {
  const d = new Date(ms);
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  if (ms >= startOfToday) {
    return formatTimeClock(ms);
  }
  if (ms >= startOfYesterday) {
    return 'Kemarin';
  }
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function formatDateDivider(ms: number, nowMs = Date.now()): string {
  const d = new Date(ms);
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  if (ms >= startOfToday) {
    return 'Hari Ini';
  }
  if (ms >= startOfYesterday) {
    return 'Kemarin';
  }
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isSameDay(msA: number, msB: number): boolean {
  const a = new Date(msA);
  const b = new Date(msB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDurationSec(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export interface DecodedMediaEnvelope {
  kind: 'text' | 'image' | 'voice';
  text: string;
  mediaDataUrl?: string;
  durationSec?: number;
}

/**
 * Serializes rich message types (text, encrypted image data URL, or voice note)
 * inside the plaintext payload prior to AES-256-GCM encryption so metadata
 * remains protected end-to-end.
 */
export function encodeEnvelopeContent(content: DecodedMediaEnvelope): string {
  if (content.kind === 'text') {
    return content.text;
  }
  return JSON.stringify({
    __sandiwa_media: true,
    kind: content.kind,
    text: content.text,
    mediaDataUrl: content.mediaDataUrl,
    durationSec: content.durationSec,
  });
}

export function decodeEnvelopeContent(plaintext: string): DecodedMediaEnvelope {
  if (plaintext.startsWith('{"__sandiwa_media":true')) {
    try {
      const parsed = JSON.parse(plaintext) as {
        __sandiwa_media?: boolean;
        kind?: 'image' | 'voice';
        text?: string;
        mediaDataUrl?: string;
        durationSec?: number;
      };
      if (parsed.__sandiwa_media && (parsed.kind === 'image' || parsed.kind === 'voice')) {
        return {
          kind: parsed.kind,
          text: parsed.text || '',
          mediaDataUrl: parsed.mediaDataUrl,
          durationSec: parsed.durationSec,
        };
      }
    } catch {
      // Fall back to plain text
    }
  }
  return { kind: 'text', text: plaintext };
}
