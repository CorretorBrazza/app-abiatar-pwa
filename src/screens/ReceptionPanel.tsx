import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Inbox from './Inbox';
import api, { apiBaseUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const loadOperationalData = async () => {
      try {
        const [boothsResponse, targetsResponse] = await Promise.all([
          api.get('/booths/assigned'),
          api.get('/notifications/operational/targets'),
        ]);
        if (mounted) {
          setBooths(Array.isArray(boothsResponse.data) ? boothsResponse.data : []);
          setOperationalTargets(Array.isArray(targetsResponse.data) ? targetsResponse.data : []);
        }
      } catch (error) {
        console.error('[RECEPTION] Falha ao atualizar operação:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadOperationalData();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const connectRealtime = async () => {
      const token = await AsyncStorage.getItem('@abiatar:token');
      if (!token || cancelled || typeof fetch === 'undefined') return;
      try {
        const response = await fetch(`${apiBaseUrl}/realtime/stream`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\\n\\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const dataLine = chunk.split('\\n').find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.replace(/^data:\s*/, ''));
              if (event.eventType?.startsWith('presence.') || event.eventType?.includes('created') || event.eventType?.includes('updated') || event.eventType?.startsWith('message.')) void loadOperationalData();
            } catch { /* heartbeat */ }
          }
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connectRealtime, 5000);
      }
    };
    void connectRealtime();
    const fallbackIntervalId = setInterval(loadOperationalData, 15000);
    return () => {
      mounted = false;
      cancelled = true;
      clearInterval(fallbackIntervalId);
      if (retryTimer) clearTimeout(retryTimer);
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
        <View style={styles.headerRow}>
          <Text style={styles.tenant}>{tenant?.name || 'ABIATAR'}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>Recepção</Text>
          </View>
        </View>
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
        ) : booths.map((booth) => {
          const onlineTargets = operationalTargets.filter((target) => target.boothId === booth.id);
          return (
            <View key={booth.id} style={styles.card}>
              <Text style={styles.cardTitle}>{booth.name}</Text>
              <Text style={styles.muted}>{booth.address}</Text>
              <Text style={onlineTargets.length > 0 ? styles.onlineStatus : styles.status}>
                {onlineTargets.length > 0 ? `ONLINE: ${onlineTargets.map((target) => target.nomeGuerra).join(', ')}` : 'Nenhum corretor online neste plantão.'}
              </Text>
              <Text style={styles.refreshText}>Atualização em tempo real; consulta de segurança a cada 15 segundos.</Text>
            </View>
          );
        })}

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
  container: { flex: 1, backgroundColor: '#fdecea' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdecea' },
  header: {
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  tenant: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roleTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  content: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  title: { width: '100%', maxWidth: 520, fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', marginTop: 20 },
  subtitle: { width: '100%', maxWidth: 520, color: '#c13a28', marginTop: 8, marginBottom: 24 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#f0b5ab' },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 8 },
  muted: { color: '#c13a28', lineHeight: 20 },
  status: { color: '#c13a28', marginTop: 12 },
  onlineStatus: { color: '#248a3d', fontWeight: '800', marginTop: 12 },
  refreshText: { color: '#c13a28', fontSize: 11, marginTop: 8 },
  inboxButton: { width: '100%', maxWidth: 520, minHeight: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexDirection: 'row', gap: 8, backgroundColor: '#FFF' },
  inboxText: { fontWeight: 'bold', fontSize: 16 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  logout: { width: '100%', maxWidth: 520, height: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  logoutText: { fontWeight: 'bold', fontSize: 16 },
});
