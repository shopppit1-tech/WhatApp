import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeKeyFingerprint,
  computeSafetyNumber,
  decryptTextPayload,
  deriveGroupAesKey,
  deriveSharedAesKey,
  encryptTextPayload,
  generateIdentityKeyPair,
} from './crypto';

test('ECDH P-256 + AES-256-GCM derives matching shared secret and encrypts/decrypts symmetrically', async () => {
  const alice = await generateIdentityKeyPair();
  const bob = await generateIdentityKeyPair();

  const chatId = 'dm_alice_bob';
  const aliceKey = await deriveSharedAesKey(alice.privateKey, bob.publicKey, chatId);
  const bobKey = await deriveSharedAesKey(bob.privateKey, alice.publicKey, chatId);

  const plaintext = 'Halo Bob, nomor virtual saya hari ini aman dan terenkripsi!';
  const aad = 'alice:bob';

  const env1 = await encryptTextPayload(aliceKey, plaintext, aad);
  const env2 = await encryptTextPayload(aliceKey, plaintext, aad);

  // Unique 96-bit IV per message ensures identical plaintexts yield distinct ciphertexts
  assert.notEqual(env1.iv, env2.iv);
  assert.notEqual(env1.ciphertext, env2.ciphertext);
  assert.equal(env1.algo, 'ECDH-P256-AES-256-GCM');

  const decryptedByBob = await decryptTextPayload(bobKey, env1.ciphertext, env1.iv, aad);
  assert.equal(decryptedByBob, plaintext);
});

test('E2EE prevents decryption by an unauthorized third party or tampered AAD/ciphertext', async () => {
  const alice = await generateIdentityKeyPair();
  const bob = await generateIdentityKeyPair();
  const eve = await generateIdentityKeyPair();

  const chatId = 'dm_alice_bob';
  const aliceKey = await deriveSharedAesKey(alice.privateKey, bob.publicKey, chatId);
  const eveKey = await deriveSharedAesKey(eve.privateKey, alice.publicKey, chatId);

  const envelope = await encryptTextPayload(aliceKey, 'Rahasia Penting', 'alice:bob');

  await assert.rejects(
    decryptTextPayload(eveKey, envelope.ciphertext, envelope.iv, 'alice:bob'),
    'Third party must fail AES-GCM decryption'
  );

  const bobKey = await deriveSharedAesKey(bob.privateKey, alice.publicKey, chatId);
  await assert.rejects(
    decryptTextPayload(bobKey, envelope.ciphertext, envelope.iv, 'tampered:aad'),
    'Tampered AAD must fail authentication tag'
  );
});

test('Safety Number is symmetric and 60 digits grouped in 12x5 blocks', async () => {
  const alice = await generateIdentityKeyPair();
  const bob = await generateIdentityKeyPair();

  const snAB = await computeSafetyNumber(
    alice.publicKey,
    bob.publicKey,
    '+62 899-1111-2222',
    '+62 899-3333-4444'
  );
  const snBA = await computeSafetyNumber(
    bob.publicKey,
    alice.publicKey,
    '+62 899-3333-4444',
    '+62 899-1111-2222'
  );

  assert.equal(snAB, snBA);
  const blocks = snAB.split(' ');
  assert.equal(blocks.length, 12);
  for (const b of blocks) {
    assert.match(b, /^\d{5}$/);
  }

  const fp = await computeKeyFingerprint(alice.publicKey);
  assert.match(fp, /^([0-9A-F]{2}:){7}[0-9A-F]{2}$/);
});

test('Group AES-256-GCM key encrypts and decrypts cleanly', async () => {
  const key = await deriveGroupAesKey('group-secret-seed-xyz', 'grp_team_1');
  const env = await encryptTextPayload(key, 'Pesan grup terenkripsi', 'uid_1:grp_team_1');
  const plain = await decryptTextPayload(key, env.ciphertext, env.iv, 'uid_1:grp_team_1');
  assert.equal(plain, 'Pesan grup terenkripsi');
});
