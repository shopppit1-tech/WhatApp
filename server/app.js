import 'dotenv/config';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import express from 'express';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const projectId = process.env.FIREBASE_PROJECT_ID || '';
const databaseId = process.env.FIREBASE_DATABASE_ID || '';
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://whatapp.my.id,http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

let services;
function getFirebaseServices() {
  if (services) return services;
  if (!projectId || !databaseId) {
    const error = new Error('Firebase project/database is not configured');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      const error = new Error('Firebase service-account JSON is invalid');
      error.code = 'CONFIG_MISSING';
      throw error;
    }
    credential = cert(serviceAccount);
  } else if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    credential = applicationDefault();
  } else {
    const error = new Error('Firebase Admin credentials are not configured');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  const adminApp = getApps().find((item) => item.name === 'whatapp-push-api')
    || initializeApp({ credential, projectId }, 'whatapp-push-api');
  services = {
    auth: getAuth(adminApp),
    db: getFirestore(adminApp, databaseId),
    messaging: getMessaging(adminApp),
  };
  return services;
}

function safeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function safeText(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength) || fallback;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const rateBuckets = new Map();
const recentEvents = new Map();
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.startedAt >= 60_000) rateBuckets.delete(key);
  }
  for (const [key, expiresAt] of recentEvents) {
    if (expiresAt <= now) recentEvents.delete(key);
  }
}, 60_000);
cleanupTimer.unref?.();

function rateLimit(req, res, next) {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const key = `${uid}:${req.path}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    bucket = { startedAt: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > 30) return res.status(429).json({ error: 'rate_limited' });
  next();
}

async function requireFirebaseUser(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'unauthorized' });
  try {
    const firebase = getFirebaseServices();
    const decoded = await firebase.auth.verifyIdToken(match[1]);
    if (decoded.email_verified !== true) {
      return res.status(403).json({ error: 'verified_email_required' });
    }
    req.user = decoded;
    req.firebase = firebase;
    next();
  } catch (error) {
    if (error?.code === 'CONFIG_MISSING') {
      return res.status(503).json({ error: 'push_backend_not_configured' });
    }
    return res.status(401).json({ error: 'invalid_auth_token' });
  }
}

async function sendToUser(req, uid, eventKey, data) {
  const { db, messaging } = req.firebase;
  const tokenSnapshot = await db.collection('pushTokens')
    .where('uid', '==', uid)
    .limit(500)
    .get();
  if (tokenSnapshot.empty) return { sent: 0, tokens: 0 };

  const uniqueKey = `${uid}:${eventKey}`;
  const now = Date.now();
  const existingExpiry = recentEvents.get(uniqueKey);
  if (existingExpiry && existingExpiry > now) return { sent: 0, tokens: 0, duplicate: true };
  recentEvents.set(uniqueKey, now + 60_000);

  const docs = tokenSnapshot.docs.filter((item) => {
    const token = item.get('token');
    return typeof token === 'string' && token.length > 0;
  });
  const tokens = docs.map((item) => item.get('token'));
  if (!tokens.length) return { sent: 0, tokens: 0 };

  const response = await messaging.sendEachForMulticast({
    tokens,
    data,
    android: { priority: 'high', ttl: 60_000 },
    webpush: { headers: { Urgency: 'high', TTL: '60' } },
  });

  const invalidCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
  ]);
  await Promise.all(response.responses.map(async (result, index) => {
    if (!result.success && invalidCodes.has(result.error?.code)) {
      await docs[index]?.ref.delete().catch(() => {});
    }
  }));
  return { sent: response.successCount, tokens: tokens.length };
}

app.get(['/health', '/api/health'], (_req, res) => {
  const hasCredential = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
  );
  res.json({
    ok: true,
    service: 'whatapp-push-api',
    configured: Boolean(projectId && databaseId && hasCredential),
    vapidKeyConfigured: Boolean(process.env.FIREBASE_VAPID_PUBLIC_KEY),
  });
});

app.get(['/config', '/api/config'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ vapidKey: process.env.FIREBASE_VAPID_PUBLIC_KEY || '' });
});

app.post(['/push/register', '/api/push/register'], requireFirebaseUser, rateLimit, async (req, res) => {
  const token = req.body?.token;
  const platform = req.body?.platform === 'native' ? 'native' : 'web';
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return res.status(400).json({ error: 'invalid_token' });
  }

  try {
    const { db } = req.firebase;
    const ref = db.collection('pushTokens').doc(tokenHash(token));
    const existing = await ref.get();
    if (!existing.exists) {
      const count = await db.collection('pushTokens').where('uid', '==', req.user.uid).limit(20).get();
      if (count.size >= 20) return res.status(429).json({ error: 'device_limit_reached' });
    }
    await ref.set({
      uid: req.user.uid,
      token,
      platform,
      userAgent: safeText(req.get('user-agent'), 256),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('push/register failed:', error?.code || error?.message || 'unknown');
    return res.status(500).json({ error: 'registration_failed' });
  }
});

app.post(['/push/unregister', '/api/push/unregister'], requireFirebaseUser, rateLimit, async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    return res.status(400).json({ error: 'invalid_token' });
  }
  try {
    const { db } = req.firebase;
    const ref = db.collection('pushTokens').doc(tokenHash(token));
    const snapshot = await ref.get();
    if (snapshot.exists && snapshot.get('uid') === req.user.uid) await ref.delete();
    return res.json({ ok: true });
  } catch (error) {
    console.error('push/unregister failed:', error?.code || error?.message || 'unknown');
    return res.status(500).json({ error: 'unregistration_failed' });
  }
});

app.post(['/push/call', '/api/push/call'], requireFirebaseUser, rateLimit, async (req, res) => {
  const callId = req.body?.callId;
  if (!safeId(callId)) return res.status(400).json({ error: 'invalid_call_id' });
  try {
    const { db } = req.firebase;
    const snapshot = await db.collection('calls').doc(callId).get();
    if (!snapshot.exists) return res.status(404).json({ error: 'call_not_found' });
    const call = snapshot.data();
    if (
      call.callerUid !== req.user.uid ||
      call.status !== 'ringing' ||
      !safeId(call.calleeUid) ||
      call.calleeUid === req.user.uid
    ) {
      return res.status(403).json({ error: 'call_not_authorized' });
    }
    const payload = {
      type: 'call',
      callId,
      callType: call.callType === 'video' ? 'video' : 'audio',
      callerAlias: safeText(call.callerAlias, 60, 'Kontak'),
      callerVirtualNumber: safeText(call.callerVirtualNumber, 32),
    };
    const result = await sendToUser(req, call.calleeUid, `call:${callId}`, payload);
    return res.status(202).json({ ok: true, ...result });
  } catch (error) {
    console.error('push/call failed:', error?.code || error?.message || 'unknown');
    return res.status(500).json({ error: 'call_push_failed' });
  }
});

app.post(['/push/message', '/api/push/message'], requireFirebaseUser, rateLimit, async (req, res) => {
  const { chatId, messageId } = req.body || {};
  if (!safeId(chatId) || !safeId(messageId)) {
    return res.status(400).json({ error: 'invalid_message_reference' });
  }
  try {
    const { db } = req.firebase;
    const chatRef = db.collection('chats').doc(chatId);
    const [chatSnapshot, messageSnapshot] = await Promise.all([
      chatRef.get(),
      chatRef.collection('messages').doc(messageId).get(),
    ]);
    if (!chatSnapshot.exists || !messageSnapshot.exists) {
      return res.status(404).json({ error: 'message_not_found' });
    }
    const chat = chatSnapshot.data();
    const message = messageSnapshot.data();
    const participants = Array.isArray(chat.participantUids) ? chat.participantUids : [];
    if (
      message.senderUid !== req.user.uid ||
      !participants.includes(req.user.uid) ||
      JSON.stringify(message.participantUids || []) !== JSON.stringify(participants)
    ) {
      return res.status(403).json({ error: 'message_not_authorized' });
    }

    const recipients = [...new Set(participants.filter((uid) => uid !== req.user.uid && safeId(uid)))];
    const results = await Promise.all(recipients.map((uid) =>
      sendToUser(req, uid, `message:${chatId}:${messageId}`, {
        type: 'message',
        chatId,
        messageId,
        title: 'Pesan baru di WhatApp',
        body: 'Anda menerima pesan terenkripsi baru.',
      }),
    ));
    return res.status(202).json({
      ok: true,
      recipients: recipients.length,
      sent: results.reduce((sum, item) => sum + item.sent, 0),
    });
  } catch (error) {
    console.error('push/message failed:', error?.code || error?.message || 'unknown');
    return res.status(500).json({ error: 'message_push_failed' });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`WhatApp push API listening on port ${port}`);
});
