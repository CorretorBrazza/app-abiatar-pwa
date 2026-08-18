import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OperationalAlertProps {
  title: string;
  body: string;
  onAcknowledge: () => void;
}

export default function OperationalAlert({ title, body, onAcknowledge }: OperationalAlertProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.badge}><Text style={styles.badgeText}>ATENÇÃO</Text></View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Text style={styles.helper}>Este é um alerta operacional do plantão.</Text>
          <TouchableOpacity style={styles.button} onPress={onAcknowledge} accessibilityRole="button">
            <Text style={styles.buttonText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#FFF', borderRadius: 18, padding: 24, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#ff3b30', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 14 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  title: { color: '#1c1c1e', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  body: { color: '#3a3a3c', fontSize: 17, lineHeight: 25 },
  helper: { color: '#8e8e93', fontSize: 13, marginTop: 16 },
  button: { backgroundColor: '#ff3b30', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
