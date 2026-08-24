/* ABIATAR FCM service worker. Firebase web configuration is public by design. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({"apiKey":"AIzaSyDSqzU4jOQZ-7zLrjyc-r8JIlQqq7MGmPw","authDomain":"abiatar-app.firebaseapp.com","projectId":"abiatar-app","storageBucket":"abiatar-app.firebasestorage.app","messagingSenderId":"391082150090","appId":"1:391082150090:web:2cf0048e0b0c23f6680c33"});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Se o payload já contém o bloco 'notification', o FCM Service Worker do navegador já exibe a notificação automaticamente.
  // Evitamos chamar self.registration.showNotification para impedir duplicidade na tela do usuário.
  if (payload.notification) {
    return;
  }
  const brandName = payload.data?.brandName || 'ABIATAR';
  const title = payload.data?.title || brandName;
  const body = payload.data?.body || (payload.data?.type === 'operational_push' ? 'Alerta operacional do plantão.' : 'Você recebeu uma nova mensagem.');
  const messageId = payload.data?.messageId || payload.data?.eventId || payload.data?.presenceId || payload.data?.pingId || 'msg-' + Date.now();
  const isOperational = payload.data?.type === 'operational_push';

  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'abiatar-' + messageId,
    renotify: false,
    requireInteraction: isOperational,
    data: { ...(payload.data || {}), url: payload.data?.url || 'https://abiatar.bitimob.com.br/#/inbox' },
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
