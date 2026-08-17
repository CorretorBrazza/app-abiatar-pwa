import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function ReceptionPanel() {
  const { user, tenant, logout } = useAuth();
  const [booths, setBooths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const primaryColor = tenant?.primary_color || '#1c1c1e';

  useEffect(() => {
    let mounted = true;
    api.get('/booths/assigned')
      .then((response) => {
        if (mounted) setBooths(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error('[RECEPTION] Falha ao carregar plantões atribuídos:', error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.muted}>Carregando plantões atribuídos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <Text style={styles.tenant}>{tenant?.name}</Text>
        <Text style={styles.role}>Recepção / Controle de Plantão</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Olá, {user?.nome_guerra}.</Text>
        <Text style={styles.subtitle}>Selecione um plantão atribuído para acompanhar a operação.</Text>

        {booths.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhum plantão atribuído</Text>
            <Text style={styles.muted}>
              A Diretoria ainda não vinculou esta recepção a um plantão. Quando houver uma atribuição,
              o acompanhamento operacional aparecerá aqui.
            </Text>
          </View>
        ) : booths.map((booth) => (
          <View key={booth.id} style={styles.card}>
            <Text style={styles.cardTitle}>{booth.name}</Text>
            <Text style={styles.muted}>{booth.address}</Text>
            <Text style={styles.status}>Painel operacional disponível após o cadastro de presença.</Text>
          </View>
        ))}

        <TouchableOpacity style={[styles.logout, { borderColor: primaryColor }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  tenant: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  role: { color: '#FFF', fontSize: 13, marginTop: 8, fontWeight: '600' },
  content: { flex: 1, padding: 24, alignItems: 'center' },
  title: { width: '100%', maxWidth: 520, fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', marginTop: 20 },
  subtitle: { width: '100%', maxWidth: 520, color: '#636366', marginTop: 8, marginBottom: 24 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e5e5ea' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  muted: { color: '#636366', lineHeight: 20 },
  status: { color: '#8e8e93', marginTop: 12 },
  logout: { width: '100%', maxWidth: 520, height: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  logoutText: { fontWeight: 'bold', fontSize: 16 },
});
