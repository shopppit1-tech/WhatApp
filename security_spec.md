# Security Specification — WhatsApp Virtual E2EE

## 1. Data Invariants
1. **PII Isolation**: Real Google account PII (`email`, `displayName`) lives exclusively in `/users/{userId}/private/info` and is readable/writable ONLY by `request.auth.uid == userId`. Other users only ever see `/directory/{userId}` containing randomized `virtualNumber`, `alias`, and ECDH P-256 `publicKey`.
2. **Sender Authenticity**: Every encrypted message in `/chats/{chatId}/messages/{messageId}` must have `senderUid == request.auth.uid`, a verified email token (`email_verified == true`), and `request.auth.uid` must be present in the parent `/chats/{chatId}.participantUids`.
3. **E2EE Algorithm Integrity**: Messages only accept `algo == "ECDH-P256-AES-256-GCM"` with non-empty `ciphertext` and `iv`, and `createdAt == request.time`.
4. **Immutable Ownership & Timestamps**: `uid`, `createdBy`, `senderUid`, and `createdAt` cannot be modified after creation.
5. **No Shadow Fields / Size Guards**: Every document enforces strict `keys().hasAll(...) && keys().hasOnly(...)`, regex ID validation (`^[a-zA-Z0-9_\-]+$`), and explicit `.size()` bounds on all strings and lists.

## 2. The "Dirty Dozen" Payloads (Must All Yield PERMISSION_DENIED)
1. **PII Read Leak**: User B reads `/users/userA/private/info` -> DENIED (`!isOwner(userId)`).
2. **Unverified Email Spoof**: User with `email_verified: false` attempts to create `/directory/userA` -> DENIED (`email_verified == true` check fails).
3. **Ghost Field Injection (Shadow Update)**: User A creates `/directory/userA` with extra `isAdmin: true` -> DENIED (`keys().hasOnly(...)` fails).
4. **UID Spoofing**: User A creates `/chats/{chatId}/messages/{msgId}` with `senderUid: "userB"` -> DENIED (`senderUid == request.auth.uid` fails).
5. **Non-Participant Message Injection**: User C (not in `chat.participantUids`) creates a message in `/chats/userA_userB/messages/m1` -> DENIED (`Master Gate` fails).
6. **Non-Participant Chat List Scraping**: User C queries `/chats` without filtering on their own UID -> DENIED (`allow list` checks `request.auth.uid in resource.data.participantUids`).
7. **Timestamp Forgery**: User A creates a message with backdated `createdAt` != `request.time` -> DENIED (`createdAt == request.time` fails).
8. **ID Poisoning**: User A writes to `/chats/invalid$id..1500chars` -> DENIED (`isValidId` fails).
9. **Public Key Curve Downgrade**: User A writes `publicKey: { kty: "RSA", crv: "weak", x: "...", y: "..." }` -> DENIED (`kty == 'EC' && crv == 'P-256'` fails).
10. **Ciphertext DoS (>16KB)**: User A sends a 100KB `ciphertext` string -> DENIED (`ciphertext.size() <= 16384` fails).
11. **Immutable Field Mutation**: User A updates `/chats/{chatId}` attempting to alter `createdBy` or `createdAt` -> DENIED (`affectedKeys().hasOnly(...)` and immutability checks fail).
12. **Message List Participant Bypass**: User C creates a message claiming `participantUids: ["userA", "userB", "userC"]` inside a 2-person chat -> DENIED (`incoming().participantUids == get(parentChat).data.participantUids` fails).
