// src/services/push.ts
import { Platform } from 'react-native';
import api from './api';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDSqzU4jOQZ-7zLrjyc-r8JIlQqq7MGmPw',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'abiatar-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'abiatar-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'abiatar-app.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '391082150090',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:391082150090:web:2cf0048e0b0c23f6680c33',
};

const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
let registrationPromise: Promise<boolean> | null = null;

function hasWebPushConfiguration() {
  if (!vapidKey) {
    console.warn('[PUSH] A chave EXPO_PUBLIC_FIREBASE_VAPID_KEY não está configurada no ambiente.');
    return false;
  }
  return Object.values(firebaseConfig).every((value) => Boolean(value));
}

export async function registerWebPushNotifications(): Promise<boolean> {
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = (async () => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('Notification' in window)
    ) {
      console.warn('[PUSH] Navegador não suporta Service Worker ou Notifications API.');
      return false;
    }

    if (!hasWebPushConfiguration()) {
      return false;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      console.warn('[PUSH] FCM Web exige HTTPS fora do localhost.');
      return false;
    }

    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { updateViaCache: 'none' },
    );
    await navigator.serviceWorker.ready;
    console.info('[PUSH] Service worker FCM registrado:', serviceWorkerRegistration.scope);

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[PUSH] Permissão de notificações não concedida:', permission);
      return false;
    }

    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
    const firebaseApp = getApps().length
      ? getApp()
      : initializeApp(firebaseConfig);
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    if (!token) {
      console.warn('[PUSH] Firebase não retornou token Web Push.');
      return false;
    }
    console.info('[PUSH] Token Web Push obtido; registrando no backend.');

    await api.post('/notifications/devices', {
      token,
      platform: 'web',
      deviceLabel: navigator.userAgent.slice(0, 140),
    });

    onMessage(messaging, (payload) => {
      window.dispatchEvent(new CustomEvent('abiatar:push', { detail: payload }));
      // O Push Operacional é apresentado pelo modal persistente do PWA;
      // não criar uma segunda notificação nativa em foreground.
      if (payload.data?.type === 'operational_push') return;

      // Se a aba estiver visível (em primeiro plano), o toast na tela já é suficiente.
      // Apenas cria a notificação do sistema se a aba/tela estiver em segundo plano.
      if (typeof document !== 'undefined' && document.hidden && Notification.permission === 'granted') {
        const brandName = payload.data?.brandName || 'ABIATAR';
        const originalTitle = payload.notification?.title || payload.data?.title;
        const body = [originalTitle, payload.notification?.body || payload.data?.body].filter(Boolean).join(' — ') || 'Você recebeu uma nova mensagem.';
        try {
          const messageId = payload.data?.messageId || payload.data?.eventId || payload.data?.presenceId || 'msg';
          const notification = new Notification(brandName, {
            body,
            icon: '/icon.png',
            tag: `abiatar-${messageId}`,
          });
          notification.onclick = () => {
            window.focus();
            window.location.hash = '#/inbox';
            notification.close();
          };
        } catch (error) {
          console.warn('[PUSH] Falha ao exibir notificação em foreground:', error);
        }
      }
    });

    return true;
  })().catch((error) => {
    console.warn('[PUSH] Não foi possível registrar este dispositivo:', error);
    return false;
  }).then((result) => {
    if (!result) registrationPromise = null;
    return result;
  });

  return registrationPromise;
}
