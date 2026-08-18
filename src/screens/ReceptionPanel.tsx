import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Inbox from './Inbox';
import api from '../services/api';
import OperationalPushComposer, { OperationalTarget } from '../components/OperationalPushComposer';

export default function ReceptionPanel() {
  const { user, tenant, logout } = useAuth();
  const [booths, setBooths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [operationalTargets, setOperationalTargets] = useState<OperationalTarget[]>([]);
  const primaryColor = tenant?.primary_color || '#1c1c1e';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get('/booths/assigned'),
      api.get('/notifications/operational/targets'),
    ])
      .then(([boothsResponse, targetsResponse]) => {
        if (mounted) {
          setBooths(Array.isArray(boothsResponse.data) ? boothsResponse.data : []);
          setOperationalTargets(Array.isArray(targetsResponse.data) ? targetsResponse.data : []);
        }
      })
      .catch((error) => {
        console.error('[RECEPTION] Falha ao carregar operação:', error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadUnreadCount = async () => {
      try {
        const response = await api.get('/messages/my-inbox');
        if (mounted) setUnreadCount(Array.isArray(response.data) ? response.data.filter((item: any) => !item.read_at).length : 0);
      } catch (error) {
        console.warn('[RECEPTION] Falha ao atualizar mensagens não lidas:', error);
      }
    };
    loadUnreadCount();
    const intervalId = setInterval(loadUnreadCount, 15000);
    const handlePush = () => loadUnreadCount();
    window.addEventListener('abiatar:push', handlePush);
    return () => {
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener('abiatar:push', handlePush);
    };
  }, []);

  if (showInbox) {
    return <Inbox onBack={() => setShowInbox(false)} />;
  }

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Olá, {user?.nome_guerra}.</Text>
        <Text style={styles.subtitle}>Selecione um plantão atribuído para acompanhar a operação.</Text>

        <TouchableOpacity style={[styles.inboxButton, { borderColor: primaryColor }]} onPress={() => setShowInbox(true)}>
          <Text style={[styles.inboxText, { color: primaryColor }]}>Mensagens / Inbox</Text>
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
        </TouchableOpacity>

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

        <OperationalPushComposer
          targets={operationalTargets}
          primaryColor={primaryColor}
          onSent={() => api.get('/notifications/operational/targets').then((response) => setOperationalTargets(Array.isArray(response.data) ? response.data : []))}
        />

        <TouchableOpacity style={[styles.logout, { borderColor: primaryColor }]} onPress={logout}>
          <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24, alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  tenant: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  role: { color: '#FFF', fontSize: 13, marginTop: 8, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  title: { width: '100%', maxWidth: 520, fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', marginTop: 20 },
  subtitle: { width: '100%', maxWidth: 520, color: '#636366', marginTop: 8, marginBottom: 24 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e5e5ea' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  muted: { color: '#636366', lineHeight: 20 },
  status: { color: '#8e8e93', marginTop: 12 },
  inboxButton: { width: '100%', maxWidth: 520, minHeight: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexDirection: 'row', gap: 8, backgroundColor: '#FFF' },
  inboxText: { fontWeight: 'bold', fontSize: 16 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  logout: { width: '100%', maxWidth: 520, height: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  logoutText: { fontWeight: 'bold', fontSize: 16 },
});
