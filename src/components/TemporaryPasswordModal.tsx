import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TemporaryPasswordModalProps {
  visible: boolean;
  temporaryPassword: string;
  onClose: () => void;
  primaryColor?: string;
}

export default function TemporaryPasswordModal({
  visible,
  temporaryPassword,
  onClose,
  primaryColor = '#e53924',
}: TemporaryPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(temporaryPassword);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: primaryColor }]}>
            <Text style={styles.badgeText}>SENHA TEMPORÁRIA</Text>
          </View>
          <Text style={styles.title}>Senha temporária criada</Text>
          <Text style={styles.body}>Ela expira em 30 minutos e exigirá troca no próximo acesso.</Text>

          <View style={styles.passwordBox}>
            <Text style={styles.passwordLabel}>SENHA</Text>
            <Text style={styles.passwordText} selectable>{temporaryPassword}</Text>
          </View>

          <View style={{ marginTop: 22, gap: 10 }}>
            <TouchableOpacity
              style={[styles.copyButton, { borderColor: primaryColor }]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Text style={[styles.copyButtonText, { color: primaryColor }]}>
                {copied ? '✔ Senha copiada!' : 'Copiar senha'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.okButton, { backgroundColor: primaryColor }]} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFF', borderRadius: 18, padding: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: '#1c1c1e', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  body: { color: '#71717a', fontSize: 15, lineHeight: 22 },
  passwordBox: { marginTop: 16, backgroundColor: '#f5f5f7', borderRadius: 12, padding: 16, alignItems: 'center' },
  passwordLabel: { color: '#71717a', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  passwordText: { color: '#1c1c1e', fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginTop: 6, textAlign: 'center' },
  copyButton: { borderRadius: 10, paddingVertical: 13, borderWidth: 2, alignItems: 'center' },
  copyButtonText: { fontSize: 15, fontWeight: '800' },
  okButton: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  okButtonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
