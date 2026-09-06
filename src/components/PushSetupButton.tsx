import React, { useState } from 'react';
import { Platform } from 'react-native';
import { registerWebPushNotifications } from '../services/push';
import IconButton, { APP_ICONS, ABIATAR_RED } from './IconButton';

interface PushSetupButtonProps {
  primaryColor?: string;
  size?: 'small' | 'medium' | 'large' | number;
}

export default function PushSetupButton({ primaryColor = ABIATAR_RED, size = 'large' }: PushSetupButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');

  if (Platform.OS !== 'web') return null;

  const enable = async () => {
    setStatus('loading');
    const registered = await registerWebPushNotifications();
    setStatus(registered ? 'ok' : 'error');
  };

  const label =
    status === 'loading'
      ? 'Ativando...'
      : status === 'ok'
      ? 'Push Ativado'
      : status === 'error'
      ? 'Reativar Push'
      : 'Ativar Notificações Push';

  return (
    <IconButton
      imageSource={APP_ICONS.ativarPush}
      label={label}
      size={size}
      borderColor={primaryColor}
      onPress={enable}
      disabled={status === 'loading' || status === 'ok'}
      loading={status === 'loading'}
    />
  );
}
