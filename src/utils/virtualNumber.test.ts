import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeterministicChatId,
  formatVirtualNumber,
  generateRandomVirtualNumber,
  generateVirtualAlias,
  normalizeVirtualDigits,
} from './virtualNumber';
import { decodeEnvelopeContent, encodeEnvelopeContent, getInitials } from './chatHelpers';

test('generateRandomVirtualNumber produces formatted Indonesian virtual numbers with high uniqueness', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    const num = generateRandomVirtualNumber();
    assert.match(num, /^\+62 (899|889|898|888)-\d{4}-\d{4}$/);
    const digits = normalizeVirtualDigits(num);
    assert.equal(digits.length, 13);
    assert.equal(formatVirtualNumber(digits), num);
    seen.add(num);
  }
  assert.ok(seen.size >= 38, 'Expected CSPRNG virtual numbers to be distinct');
});

test('generateVirtualAlias masks Google identity using trailing digits', () => {
  const alias = generateVirtualAlias('+62 899-1234-5678');
  assert.equal(alias, 'Anonim #5678');
});

test('createDeterministicChatId is order-independent and Firestore-ID-safe', () => {
  const id1 = createDeterministicChatId('user_B', 'user_A');
  const id2 = createDeterministicChatId('user_A', 'user_B');
  assert.equal(id1, id2);
  assert.match(id1, /^[a-zA-Z0-9_-]+$/);
});

test('encodeEnvelopeContent and decodeEnvelopeContent round-trip rich media payloads', () => {
  const encodedText = encodeEnvelopeContent({ kind: 'text', text: 'Halo dunia' });
  assert.deepEqual(decodeEnvelopeContent(encodedText), { kind: 'text', text: 'Halo dunia' });

  const encodedVoice = encodeEnvelopeContent({
    kind: 'voice',
    text: 'Pesan suara (0:08)',
    durationSec: 8,
  });
  const decodedVoice = decodeEnvelopeContent(encodedVoice);
  assert.equal(decodedVoice.kind, 'voice');
  assert.equal(decodedVoice.durationSec, 8);

  assert.equal(getInitials('Rina Kusuma'), 'RK');
});
