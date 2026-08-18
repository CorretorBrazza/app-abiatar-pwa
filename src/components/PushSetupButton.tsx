import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { registerWebPushNotifications } from '../services/push';

export default function PushSetupButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  if (Platform.OS !== 'web') return null;

  const enable = async () => {
    setStatus('loading');
    const registered = await registerWebPushNotifications();
    setStatus(registered ? 'ok' : 'error');
  };

  return (
    <TouchableOpacity style={styles.button} onPress={enable} disabled={status === 'loading'}>
      <Text style={styles.text}>
        {status === 'loading' ? 'Ativando notificações...' : status === 'ok' ? 'Notificações ativadas' : status === 'error' ? 'Tentar ativar notificações novamente' : 'Ativar notificações push'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', maxWidth: 520, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#ff9500', backgroundColor: '#fff8ed', alignItems: 'center', marginBottom: 16 },
  text: { color: '#9a5b00', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
});
