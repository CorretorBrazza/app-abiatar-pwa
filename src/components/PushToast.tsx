import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PushToastProps {
  title: string;
  body: string;
  onPress: () => void;
}

export default function PushToast({ title, body, onPress }: PushToastProps) {
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <TouchableOpacity style={styles.toast} onPress={onPress} accessibilityRole="button">
        <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.body} numberOfLines={2}>{body}</Text>
          <Text style={styles.action}>Abrir mensagens</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 18, left: 0, right: 0, zIndex: 1000, alignItems: 'center' },
  toast: { width: '92%', maxWidth: 520, backgroundColor: '#1c1c1e', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  iconText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  copy: { flex: 1 },
  title: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  body: { color: '#f2f2f7', fontSize: 13, marginTop: 2 },
  action: { color: '#64d2ff', fontSize: 12, fontWeight: 'bold', marginTop: 6 },
});
