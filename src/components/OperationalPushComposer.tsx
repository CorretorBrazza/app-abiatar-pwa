import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../services/api';

export interface OperationalTarget {
  recipientId: string;
  nomeGuerra: string;
  boothId: string;
  boothName: string;
  presenceId: string;
  checkInAt?: string;
}

interface Props {
  targets: OperationalTarget[];
  primaryColor: string;
  onSent?: () => void;
}

export default function OperationalPushComposer({ targets, primaryColor, onSent }: Props) {
  const [selected, setSelected] = useState<OperationalTarget | null>(null);
  const [title, setTitle] = useState('Cliente chegou');
  const [body, setBody] = useState('Um cliente chegou ao plantão. Por favor, dirija-se ao atendimento.');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!selected || !title.trim() || !body.trim()) return;
    try {
      setSending(true);
      await api.post('/notifications/operational', {
        recipientId: selected.recipientId,
        boothId: selected.boothId,
        title: title.trim(),
        body: body.trim(),
      });
      alert(`Push Operacional enviado para ${selected.nomeGuerra}.`);
      setSelected(null);
      onSent?.();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Não foi possível enviar o Push Operacional.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Push Operacional</Text>
      <Text style={styles.description}>Use somente para avisos imediatos do plantão. O corretor precisa estar online.</Text>
      {targets.length === 0 ? (
        <Text style={styles.empty}>Nenhum corretor online disponível neste escopo.</Text>
      ) : (
        <>
          <Text style={styles.label}>Escolha o corretor</Text>
          <View style={styles.targets}>
            {targets.map((target) => (
              <TouchableOpacity
                key={target.presenceId}
                style={[styles.target, selected?.presenceId === target.presenceId && { borderColor: primaryColor, backgroundColor: '#fdecea' }]}
                onPress={() => setSelected(target)}
              >
                <Text style={styles.targetName}>{target.nomeGuerra}</Text>
                <Text style={styles.targetBooth}>{target.boothName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selected && (
            <>
              <Text style={styles.label}>Título do alerta</Text>
              <TextInput value={title} onChangeText={setTitle} style={styles.input} maxLength={120} />
              <Text style={styles.label}>Aviso</Text>
              <TextInput value={body} onChangeText={setBody} style={[styles.input, styles.multiline]} multiline maxLength={1000} />
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: primaryColor }]} onPress={send} disabled={sending}>
                {sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sendText}>Enviar Push para {selected.nomeGuerra}</Text>}
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#ff9500' },
  heading: { fontSize: 19, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  description: { color: '#c13a28', lineHeight: 20, marginBottom: 16 },
  label: { color: '#c13a28', fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  targets: { gap: 8 },
  target: { borderWidth: 1, borderColor: '#f0b5ab', borderRadius: 9, padding: 11 },
  targetName: { color: '#1c1c1e', fontSize: 15, fontWeight: '700' },
  targetBooth: { color: '#c13a28', fontSize: 12, marginTop: 3 },
  input: { borderWidth: 1, borderColor: '#f0b5ab', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#1c1c1e', backgroundColor: '#FFF' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  sendButton: { borderRadius: 9, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  sendText: { color: '#FFF', fontWeight: '800' },
  empty: { color: '#c13a28', lineHeight: 20 },
});
