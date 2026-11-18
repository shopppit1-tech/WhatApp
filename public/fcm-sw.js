/* Firebase Cloud Messaging background handler for the existing Workbox PWA worker. */
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.3.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAKsdGIGzCUFesAJ-3KBwh6cVUbubfS1U0',
  authDomain: 'gen-lang-client-0817260391.firebaseapp.com',
  projectId: 'gen-lang-client-0817260391',
  storageBucket: 'gen-lang-client-0817260391.firebasestorage.app',
  messagingSenderId: '26822846187',
  appId: '1:26822846187:web:3b8b6925f85bbed5aac0ae',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const isCall = data.type === 'call';
  const title = isCall
    ? `${data.callType === 'video' ? 'Video call' : 'Panggilan suara'} masuk`
    : (data.title || 'Pesan baru di WhatApp');
  const body = isCall
    ? `${data.callerAlias || 'Kontak'}${data.callerVirtualNumber ? ` (${data.callerVirtualNumber})` : ''}`
    : (data.body || 'Anda menerima pesan terenkripsi baru.');

  return self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: isCall ? `whatapp-call-${data.callId || 'incoming'}` : `whatapp-message-${data.chatId || 'new'}`,
    renotify: isCall,
    requireInteraction: isCall,
    vibrate: isCall ? [700, 350, 700, 350, 700] : [250, 150, 250],
    data: {
      type: data.type || 'message',
      callId: data.callId || '',
      chatId: data.chatId || '',
    },
    actions: isCall
      ? [
          { action: 'accept', title: 'Terima' },
          { action: 'reject', title: 'Tolak' },
        ]
      : [{ action: 'open', title: 'Buka WhatApp' }],
  });
});
