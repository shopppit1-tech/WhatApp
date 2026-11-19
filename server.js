const express = require('express');
const path = require('path');
const fs = require('fs');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')));
  }
  return applicationDefault();
}

initializeApp({
  credential: loadCredential(),
  projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0817260391',
});

const db = getFirestore();
const messaging = getMessaging();
const app = express();
const seen = { calls: new Set(), messages: new Set() };
let listenersReady = false;

app.get('/health', (_req, res) => res.json({ ok: true, service: 'whatapp-push', listenersReady }));
app.use(express.static(path.join(ROOT, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));

function tokenId(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

async function tokensForUsers(uids) {
  const recipients = [];
  for (const uid of [...new Set(uids.filter(Boolean))]) {
    const snapshot = await db.collection('users').doc(uid).collection('devices').get();
    snapshot.forEach((item) => {
      const data = item.data();
      if (data.enabled !== false && typeof data.fcmToken === 'string' && data.fcmToken.length > 20) {
        recipients.push({ token: data.fcmToken, ref: item.ref });
      }
    });
  }
  return recipients;
}

async function sendPush(uids, data) {
  const recipients = await tokensForUsers(uids);
  if (!recipients.length) return;
  const result = await messaging.sendEachForMulticast({
    tokens: recipients.map((item) => item.token),
    data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value ?? '')])),
    android: { priority: 'high', ttl: 60 * 1000 },
  });
  await Promise.all(result.responses.map((response, index) => {
    const code = response.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      return recipients[index].ref.delete();
    }
    return null;
  }));
}

function watchCalls() {
  db.collection('calls').onSnapshot((snapshot) => {
    if (!listenersReady) {
      snapshot.docs.forEach((doc) => seen.calls.add(doc.id));
      return;
    }
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added' || seen.calls.has(change.doc.id)) continue;
      seen.calls.add(change.doc.id);
      const call = change.doc.data();
      if (call.status !== 'ringing' || !call.calleeUid) continue;
      sendPush([call.calleeUid], {
        type: 'call',
        callId: change.doc.id,
        callType: call.callType === 'video' ? 'video' : 'audio',
        callerAlias: call.callerAlias || 'Kontak',
        callerVirtualNumber: call.callerVirtualNumber || '',
        title: call.callType === 'video' ? 'Video Call masuk' : 'Panggilan suara masuk',
        body: `${call.callerAlias || 'Kontak'} sedang menghubungi Anda.`,
      }).catch((error) => console.error('FCM call error:', error.message));
    }
  }, (error) => console.error('Firestore calls listener:', error.message));
}

function watchMessages() {
  db.collectionGroup('messages').onSnapshot((snapshot) => {
    if (!listenersReady) {
      snapshot.docs.forEach((doc) => seen.messages.add(doc.id));
      return;
    }
    for (const change of snapshot.docChanges()) {
      if (change.type !== 'added' || seen.messages.has(change.doc.id)) continue;
      seen.messages.add(change.doc.id);
      const message = change.doc.data();
      if (!Array.isArray(message.participantUids)) continue;
      const chatId = change.doc.ref.parent.parent?.id || '';
      sendPush(message.participantUids.filter((uid) => uid !== message.senderUid), {
        type: 'chat',
        chatId,
        messageId: change.doc.id,
        title: 'Pesan WhatApp baru',
        body: 'Anda menerima pesan baru.',
      }).catch((error) => console.error('FCM chat error:', error.message));
    }
  }, (error) => console.error('Firestore messages listener:', error.message));
}

watchCalls();
watchMessages();
setTimeout(() => { listenersReady = true; }, 5000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatApp cPanel server listening on ${PORT}`);
});
