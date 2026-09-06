import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import IconButton, { ABIATAR_RED } from './IconButton';

interface BrokerMaterialsProps {
  primaryColor: string;
  onOpenMaterials: () => Promise<void>;
}

export default function BrokerMaterials({ primaryColor = ABIATAR_RED, onOpenMaterials }: BrokerMaterialsProps) {
  const handlePrices = () => {
    Alert.alert('Tabela de Preços Atualizada', 'Este material será disponibilizado em breve.');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Materiais para atendimento</Text>
      <View style={styles.grid}>
        <IconButton
          name="file-text"
          label="Tabela de Preços"
          size="large"
          borderColor={primaryColor}
          disabled={true}
          onPress={handlePrices}
          accessibilityLabel="Tabela de Preços Atualizada"
        />
        <IconButton
          name="folder"
          label="Material Empreendimentos"
          size="large"
          borderColor={primaryColor}
          onPress={onOpenMaterials}
          accessibilityLabel="Material Empreendimentos"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', maxWidth: 520, marginBottom: 16, alignItems: 'center' },
  title: { color: '#1c1c1e', fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', justifyContent: 'center', gap: 20, flexWrap: 'wrap' },
});
