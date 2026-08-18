import { mkdir, writeFile } from 'node:fs/promises';

const config = {
  // Configuração Web do Firebase: pública por definição. Os fallbacks
  // impedem que um build sem ambiente gere um service worker inválido.
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDSqzU4jOQZ-7zLrjyc-r8JIlQqq7MGmPw',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'abiatar-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'abiatar-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'abiatar-app.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '391082150090',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:391082150090:web:2cf0048e0b0c23f6680c33',
};

const content = `/* ABIATAR FCM service worker. Firebase web configuration is public by design. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const brandName = payload.data?.brandName || 'ABIATAR';
  const originalTitle = payload.notification?.title;
  const messageId = payload.data?.messageId || payload.messageId || 'message-' + Date.now();
  const isOperational = payload.data?.type === 'operational_push';
  self.registration.showNotification(brandName, {
    body: [originalTitle, payload.notification?.body].filter(Boolean).join(' — ') || (isOperational ? 'Alerta operacional do plantão.' : 'Você recebeu uma nova mensagem.'),
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'abiatar-' + messageId,
    renotify: true,
    requireInteraction: isOperational,
    data: { ...(payload.data || {}), url: 'https://abiatar.bitimob.com.br/#/inbox' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://abiatar.bitimob.com.br/#/inbox';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ('focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    return clients.openWindow(url);
  }));
});
`;

await mkdir('public', { recursive: true });
await writeFile('public/firebase-messaging-sw.js', content, 'utf8');
