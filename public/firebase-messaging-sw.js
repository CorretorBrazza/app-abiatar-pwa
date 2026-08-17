/* Generated during web:build. Do not add service-account credentials here. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {"apiKey":"","authDomain":"","projectId":"","storageBucket":"","messagingSenderId":"","appId":""};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'ABIATAR';
  const options = {
    body: payload.notification?.body || 'Você recebeu uma nova atualização.',
    icon: '/icon.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('https://abiatar.bitimob.com.br'));
});
