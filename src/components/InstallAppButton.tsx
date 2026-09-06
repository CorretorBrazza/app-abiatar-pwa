import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { ABIATAR_RED } from './IconButton';

const FAVICON = require('../../assets/favicon.png');

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  // iPadOS 13+ reports as macOS; detect by touch support
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [buttonVisible, setButtonVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const devicePlatform = useRef(detectPlatform()).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Registra SW na montagem para garantir que a página seja "controlled"
    // (pré-requisito para instalabilidade no Chrome).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' }).catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
      setButtonVisible(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setButtonVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS não dispara beforeinstallprompt — sempre mostra o botão para
    // orientar o usuário a instalar manualmente via Compartilhar → Adicionar à Tela.
    if (devicePlatform === 'ios') {
      setButtonVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [devicePlatform]);

  const handlePress = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setInstalled(true);
          setButtonVisible(false);
        }
      } catch {
        // Prompt falhou — mostra guia como fallback
      }
      setDeferredPrompt(null);
      return;
    }
    // Sem prompt disponível (iOS / Firefox /<Edge antigo): mostrar instruções
    setGuideVisible(true);
  }, [deferredPrompt]);

  if (Platform.OS !== 'web' || installed || !buttonVisible) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityLabel="Instalar aplicativo Abiatar"
        accessibilityRole="button"
      >
        <Image source={FAVICON} style={styles.fabIcon} resizeMode="contain" />
        <Text style={styles.fabLabel}>Instalar{'\n'}Abiatar</Text>
      </TouchableOpacity>

      <Modal
        visible={guideVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGuideVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Image source={FAVICON} style={styles.modalIcon} resizeMode="contain" />
            <Text style={styles.modalTitle}>Como instalar o Abiatar</Text>

            <View style={styles.step}>
              <Text style={styles.stepHead}>Android (Chrome / Edge / Samsung Internet)</Text>
              <Text style={styles.stepBody}>
                1. Toque no menu ⋮ (três pontos) no canto superior direito.{'\n'}
                2. Selecione <Text style={styles.bold}>Instalar aplicativo</Text> ou{' '}
                <Text style={styles.bold}>Adicionar à tela inicial</Text>.{'\n'}
                3. Confirme no pop-up que aparecer.
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepHead}>iPhone / iPad (Safari)</Text>
              <Text style={styles.stepBody}>
                1. Toque no botão <Text style={styles.bold}>Compartilhar</Text> (quadrado com seta para cima) na barra inferior.{'\n'}
                2. Role para baixo e toque em <Text style={styles.bold}>Adicionar à Tela de Início</Text>.{'\n'}
                3. Toque em <Text style={styles.bold}>Adicionar</Text> no canto superior direito.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setGuideVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonLabel}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* FAB flutuante */
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    zIndex: 9999,
    elevation: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    borderWidth: 2,
    borderColor: ABIATAR_RED,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  fabIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
  },
  fabLabel: {
    color: ABIATAR_RED,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },

  /* Modal de instruções */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  modalIcon: {
    width: 48,
    height: 48,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: 20,
    textAlign: 'center',
  },
  step: {
    alignSelf: 'stretch',
    backgroundColor: '#f9f9fb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  stepHead: {
    fontSize: 13,
    fontWeight: '800',
    color: ABIATAR_RED,
    marginBottom: 6,
  },
  stepBody: {
    fontSize: 13,
    color: '#3c3c43',
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
  },
  closeButton: {
    marginTop: 8,
    backgroundColor: ABIATAR_RED,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  closeButtonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});