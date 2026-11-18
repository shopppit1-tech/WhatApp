import { getMessaging, getToken, isSupported, onMessage, deleteToken } from 'firebase/messaging';
import type { User } from 'firebase/auth';
import { app, auth } from './firebase';

const VAPID_KEY_OVERRIDE = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const API_BASE = (import.meta.env.VITE_PUSH_API_BASE || '/api').replace(/\/+$/, '');

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function postWithAuth(user: User, path: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(typeof result.error === 'string' ? result.error : `push_api_${response.status}`);
  }
}

async function currentWebToken(): Promise<string | null> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return null;
  }
  if (!(await isSupported())) return null;
  let vapidKey = VAPID_KEY_OVERRIDE;
  if (!vapidKey) {
    try {
      const response = await fetch(apiUrl('/config'), { cache: 'no-store' });
      if (!response.ok) return null;
      const config = await response.json();
      vapidKey = typeof config.vapidKey === 'string' ? config.vapidKey : '';
    } catch {
      return null;
    }
  }
  if (!vapidKey) return null;
  const registration = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function registerPushToken(user: User): Promise<boolean> {
  const token = await currentWebToken();
  if (!token) return false;
  await postWithAuth(user, '/push/register', { token, platform: 'web' });
  return true;
}

export async function unregisterPushToken(user: User): Promise<void> {
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  const token = await currentWebToken();
  if (!token) return;
  try {
    await postWithAuth(user, '/push/unregister', { token });
  } finally {
    await deleteToken(messaging).catch(() => false);
  }
}

export async function notifyIncomingCall(callId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await postWithAuth(user, '/push/call', { callId });
}

export async function notifyNewMessage(chatId: string, messageId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await postWithAuth(user, '/push/message', { chatId, messageId });
}

export async function listenForForegroundPush(): Promise<() => void> {
  if (typeof window === 'undefined' || !(await isSupported())) return () => {};
  return onMessage(getMessaging(app), (payload) => {
    if (document.visibilityState === 'visible') return;
    const data = payload.data || {};
    const isCall = data.type === 'call';
    const title = isCall
      ? `${data.callType === 'video' ? 'Video call' : 'Panggilan suara'} masuk`
      : (data.title || 'Pesan baru di WhatApp');
    const body = isCall
      ? `${data.callerAlias || 'Kontak'}${data.callerVirtualNumber ? ` (${data.callerVirtualNumber})` : ''}`
      : (data.body || 'Anda menerima pesan terenkripsi baru.');
    const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: isCall ? `whatapp-call-${data.callId || 'incoming'}` : `whatapp-message-${data.chatId || 'new'}`,
      requireInteraction: isCall,
      data: { type: data.type || 'message', callId: data.callId || '', chatId: data.chatId || '' },
      actions: isCall
        ? [
            { action: 'accept', title: 'Terima' },
            { action: 'reject', title: 'Tolak' },
          ]
        : [{ action: 'open', title: 'Buka WhatApp' }],
    };
    void navigator.serviceWorker?.ready.then((registration) =>
      registration.showNotification(title, options),
    );
  });
}
