import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ScreenCodeProps {
  code: string;
}

export default function ScreenCode({ code }: ScreenCodeProps) {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.text}>[{code}]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 10, right: 12, zIndex: 50 },
  text: { color: '#c13a28', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
});
