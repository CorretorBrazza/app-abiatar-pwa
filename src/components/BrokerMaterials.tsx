import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BrokerMaterialsProps {
  primaryColor: string;
  onOpenMaterials: () => Promise<void>;
}

export default function BrokerMaterials({ primaryColor, onOpenMaterials }: BrokerMaterialsProps) {
  const handlePrices = () => {
    Alert.alert('Tabela de Preços Atualizada', 'Este material será disponibilizado em breve.');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Materiais para atendimento</Text>
      <TouchableOpacity style={[styles.button, styles.disabled]} onPress={handlePrices} accessibilityLabel="Tabela de Preços Atualizada">
        <Text style={styles.buttonText}>Tabela de Preços Atualizada</Text>
        <Text style={styles.hint}>Material em preparação</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, { backgroundColor: primaryColor }]} onPress={onOpenMaterials} accessibilityLabel="Material Empreendimentos">
        <Text style={styles.buttonText}>Material Empreendimentos</Text>
        <Text style={styles.hintLight}>Abrir material Abiatar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', maxWidth: 520, marginBottom: 16 },
  title: { color: '#1c1c1e', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  button: { minHeight: 58, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', marginBottom: 10 },
  disabled: { backgroundColor: '#f0b5ab' },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  hint: { color: '#c13a28', fontSize: 11, marginTop: 3 },
  hintLight: { color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 3 },
});
