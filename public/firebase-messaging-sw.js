/* ABIATAR FCM service worker. Firebase web configuration is public by design. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({"apiKey":"AIzaSyDSqzU4jOQZ-7zLrjyc-r8JIlQqq7MGmPw","authDomain":"abiatar-app.firebaseapp.com","projectId":"abiatar-app","storageBucket":"abiatar-app.firebasestorage.app","messagingSenderId":"391082150090","appId":"1:391082150090:web:2cf0048e0b0c23f6680c33"});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'ABIATAR';
  const messageId = payload.data?.messageId || payload.messageId || 'message-' + Date.now();
  const isOperational = payload.data?.type === 'operational_push';
  self.registration.showNotification(title, {
    body: payload.notification?.body || (isOperational ? 'Alerta operacional do plantão.' : 'Você recebeu uma nova mensagem.'),
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
