const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2/options');

initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const db = getFirestore();
const messaging = getMessaging();

function notificationId(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

async function tokensForUsers(uids) {
  const tokens = [];
  for (const uid of [...new Set(uids.filter(Boolean))]) {
    const snapshot = await db.collection('users').doc(uid).collection('devices').get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.enabled !== false && typeof data.fcmToken === 'string' && data.fcmToken.length > 20) {
        tokens.push({ token: data.fcmToken, ref: doc.ref });
      }
    });
  }
  return tokens;
}

async function sendToUsers(uids, data) {
  const recipients = await tokensForUsers(uids);
  if (!recipients.length) return;
  const response = await messaging.sendEachForMulticast({
    tokens: recipients.map((item) => item.token),
    data,
    android: {
      priority: 'high',
      ttl: 60 * 1000,
    },
  });
  const invalid = [];
  response.responses.forEach((result, index) => {
    const code = result.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      invalid.push(recipients[index].ref.delete());
    }
  });
  await Promise.all(invalid);
}

exports.onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message || !Array.isArray(message.participantUids)) return;
  const recipients = message.participantUids.filter((uid) => uid !== message.senderUid);
  await sendToUsers(recipients, {
    type: 'chat',
    chatId: event.params.chatId,
    messageId: event.params.messageId,
    title: 'Pesan WhatApp baru',
    body: 'Anda menerima pesan baru.',
  });
});

exports.onCallCreated = onDocumentCreated('calls/{callId}', async (event) => {
  const call = event.data?.data();
  if (!call || call.status !== 'ringing' || !call.calleeUid) return;
  await sendToUsers([call.calleeUid], {
    type: 'call',
    callId: event.params.callId,
    callType: call.callType === 'video' ? 'video' : 'audio',
    callerAlias: String(call.callerAlias || 'Kontak'),
    callerVirtualNumber: String(call.callerVirtualNumber || ''),
    title: call.callType === 'video' ? 'Video Call masuk' : 'Panggilan suara masuk',
    body: `${String(call.callerAlias || 'Kontak')} sedang menghubungi Anda.`,
  });
});
