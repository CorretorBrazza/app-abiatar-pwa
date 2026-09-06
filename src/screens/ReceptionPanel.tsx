import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import Inbox from './Inbox';
import api, { apiBaseUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OperationalPushComposer, { OperationalTarget } from '../components/OperationalPushComposer';
import IconButton, { APP_ICONS } from '../components/IconButton';

export default function ReceptionPanel() {
  const { user, tenant, logout } = useAuth();
  const [booths, setBooths] = useState<any[]>([]);
  const [queues, setQueues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [operationalTargets, setOperationalTargets] = useState<OperationalTarget[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [checkInOpenBooth, setCheckInOpenBooth] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const primaryColor = tenant?.primary_color || '#e53924';

  const loadOperationalData = async () => {
    try {
      const [boothsResponse, targetsResponse, brokersResponse] = await Promise.all([
        api.get('/booths/assigned'),
        api.get('/notifications/operational/targets'),
        api.get('/users/reception-brokers'),
      ]);
      const assignedBooths = Array.isArray(boothsResponse.data) ? boothsResponse.data : [];
      const queueByBooth: Record<string, any> = {};
      await Promise.all(
        assignedBooths.map(async (booth: any) => {
          try {
            const queueResponse = await api.get(`/presences/booths/${booth.id}/queue`);
            if (queueResponse.data) queueByBooth[booth.id] = queueResponse.data;
          } catch (error) {
            console.warn(`[RECEPTION] Falha ao carregar a fila do plantão ${booth.id}:`, error);
          }
        }),
      );
      setBooths(assignedBooths);
      setQueues(queueByBooth);
      setOperationalTargets(Array.isArray(targetsResponse.data) ? targetsResponse.data : []);
      setBrokers(Array.isArray(brokersResponse.data) ? brokersResponse.data : []);
    } catch (error) {
      console.error('[RECEPTION] Falha ao atualizar operação:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceCheckIn = async (brokerId: string, nomeGuerra: string, booth: any) => {
    if (typeof window !== 'undefined' && !window.confirm(`Efetuar check-in de '${nomeGuerra}' neste plantão (${booth.name})? O check-in precisa estar dentro da janela da roleta atual.`)) return;
    setActionBusy(brokerId);
    try {
      const response = await api.post('/presences/force-check-in', { brokerId, boothId: booth.id });
      alert(response.data.message || 'Check-in registrado.');
      setCheckInOpenBooth(null);
      void loadOperationalData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Não foi possível efetuar o check-in.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleAttend = async (presenceId: string, nomeGuerra: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Confirmar atendimento de '${nomeGuerra}'? O próximo da fila será convocado.`)) return;
    setActionBusy(presenceId);
    try {
      const response = await api.post(`/presences/attend/${presenceId}`);
      alert(response.data.message || 'Atendimento registrado.');
      void loadOperationalData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Não foi possível registrar o atendimento.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleRevalidate = async (presenceId: string, nomeGuerra: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Revalidar a presença de '${nomeGuerra}'? A posição dele na fila será mantida.`)) return;
    setActionBusy(presenceId);
    try {
      const response = await api.post('/presences/force-validate', { presenceId });
      alert(response.data.message || 'Presença revalidada.');
      void loadOperationalData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Não foi possível revalidar a presença.');
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    let mounted = true;
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
    const fallbackIntervalId = setInterval(() => void loadOperationalData(), 15000);
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

        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <IconButton
            imageSource={APP_ICONS.mensagens}
            label="Mensagens / Inbox"
            badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
            size="large"
            borderColor={primaryColor}
            onPress={() => setShowInbox(true)}
          />
        </View>

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
          const boothQueue = queues[booth.id] || null;
          return (
            <View key={booth.id} style={styles.card}>
              <Text style={styles.cardTitle}>{booth.name}</Text>
              <Text style={styles.muted}>{booth.address}</Text>
              <Text style={onlineTargets.length > 0 ? styles.onlineStatus : styles.status}>
                {onlineTargets.length > 0 ? `ONLINE: ${onlineTargets.map((target) => target.nomeGuerra).join(', ')}` : 'Nenhum corretor online neste plantão.'}
              </Text>

              {boothQueue?.currentRoleta ? (
                <>
                  <View style={styles.roletaDivider} />
                  <View style={styles.roletaHeader}>
                    <Text style={styles.roletaTitle}>Roleta do momento</Text>
                    <Text style={styles.roletaName}>{boothQueue.currentRoleta.name}</Text>
                    <Text style={styles.muted}>
                      Sorteio às {boothQueue.currentRoleta.drawTimeFormatted}
                      {boothQueue.currentRoleta.phase === 'aguardando_sorteio' ? ' · aguardando sorteio' : ''}
                    </Text>
                  </View>

                  {boothQueue.queue.length === 0 ? (
                    <Text style={styles.emptyQueue}>Fila vazia na roleta atual.</Text>
                  ) : (
                    boothQueue.queue.map((item: any) => (
                      <View key={item.presenceId} style={[styles.queueItem, item.effectivePosition === 1 && styles.queueItemNext]}>
                        <View style={styles.queueLeft}>
                          <Text style={styles.queuePosition}>#{item.effectivePosition}</Text>
                          <View>
                            <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>
                              {item.roletaEntryType === 'pos_barra' ? `Pós-barra (${item.roletaPosition}º)` : `Sorteado ${item.roletaPosition}º`} · {item.minutesActive} min ativo
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.actionButton, actionBusy === item.presenceId && styles.actionButtonDisabled]}
                          disabled={actionBusy === item.presenceId}
                          onPress={() => void handleAttend(item.presenceId, item.nomeGuerra)}
                        >
                          <Text style={styles.actionButtonText}>{actionBusy === item.presenceId ? '...' : item.effectivePosition === 1 ? '🛎 Atendimento' : 'Atender'}</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

                  {boothQueue.awaitingRevalidation?.length > 0 && (
                    <View style={styles.absentBlock}>
                      <Text style={styles.absentTitle}>Presenças suspensas (ausência) — aguardando revalidação</Text>
                      {boothQueue.awaitingRevalidation.map((item: any) => (
                        <View key={item.presenceId} style={styles.queueItem}>
                          <View style={styles.queueLeft}>
                            <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>{item.roletaPosition ? `Posição ${item.roletaPosition}º mantida` : 'Aguardando sorteio'}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.actionButtonRevalidate, actionBusy === item.presenceId && styles.actionButtonDisabled]}
                            disabled={actionBusy === item.presenceId}
                            onPress={() => void handleRevalidate(item.presenceId, item.nomeGuerra)}
                          >
                            <Text style={styles.actionButtonText}>{actionBusy === item.presenceId ? '...' : '✓ Revalidar'}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noRoleta}>Nenhuma roleta em andamento neste momento.</Text>
              )}

              <TouchableOpacity
                style={[styles.checkInToggle, checkInOpenBooth === booth.id && styles.checkInToggleOpen]}
                onPress={() => setCheckInOpenBooth(checkInOpenBooth === booth.id ? null : booth.id)}
              >
                <Text style={styles.checkInToggleText}>{checkInOpenBooth === booth.id ? '− Fechar check-in manual' : '+ Efetuar check-in de corretor'}</Text>
              </TouchableOpacity>

              {checkInOpenBooth === booth.id && (
                <View style={styles.checkInBlock}>
                  {brokers.length === 0 ? (
                    <Text style={styles.muted}>Nenhum corretor cadastrado encontrado.</Text>
                  ) : (
                    brokers.map((brokerItem: any) => {
                      const busy = brokerItem.activePresence !== null;
                      const unavailable = busy || brokerItem.stageExpired === true;
                      return (
                        <View key={brokerItem.id} style={styles.queueItem}>
                          <View style={styles.queueLeft}>
                            <Text style={styles.queueName}>{brokerItem.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>
                              {brokerItem.activePresence?.status === 'online'
                                ? 'Já em turno'
                                : brokerItem.activePresence?.status === 'absent'
                                  ? 'Turno suspenso (ausência)'
                                  : brokerItem.stageExpired === true
                                    ? 'Estágio expirado'
                                    : 'Disponível'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.actionButton, unavailable && styles.actionButtonDisabled]}
                            disabled={unavailable || actionBusy === brokerItem.id}
                            onPress={() => void handleForceCheckIn(brokerItem.id, brokerItem.nomeGuerra, booth)}
                          >
                            <Text style={styles.actionButtonText}>{actionBusy === brokerItem.id ? '...' : 'Check-in'}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              <Text style={styles.refreshText}>Atualização em tempo real; consulta de segurança a cada 15 segundos.</Text>
            </View>
          );
        })}

        <OperationalPushComposer
          targets={operationalTargets}
          primaryColor={primaryColor}
          onSent={() => api.get('/notifications/operational/targets').then((response) => setOperationalTargets(Array.isArray(response.data) ? response.data : []))}
        />

        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <IconButton
            imageSource={APP_ICONS.sair}
            label="Encerrar Sessão"
            size="large"
            borderColor={primaryColor}
            onPress={logout}
          />
        </View>
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
  roletaDivider: { height: 1, backgroundColor: '#f0b5ab', marginVertical: 12 },
  roletaHeader: { marginBottom: 12 },
  roletaTitle: { fontSize: 11, fontWeight: '800', color: '#c13a28', textTransform: 'uppercase', letterSpacing: 0.5 },
  roletaName: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e', marginVertical: 4 },
  emptyQueue: { color: '#c13a28', fontStyle: 'italic', marginVertical: 8 },
  noRoleta: { color: '#c13a28', marginTop: 12 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    backgroundColor: '#fdecea',
    padding: 10,
    marginBottom: 8,
  },
  queueItemNext: { borderColor: '#248a3d', backgroundColor: '#e8f5ec' },
  queueLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  queuePosition: { fontWeight: '900', fontSize: 15, color: '#e53924' },
  queueName: { fontWeight: '700', color: '#1c1c1e', fontSize: 14 },
  queueMeta: { color: '#c13a28', fontSize: 11, marginTop: 2 },
  actionButton: {
    backgroundColor: '#248a3d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonRevalidate: {
    backgroundColor: '#b45309',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  absentBlock: { marginTop: 4 },
  absentTitle: { fontSize: 12, fontWeight: '800', color: '#b45309', marginBottom: 8 },
  checkInToggle: {
    borderWidth: 1,
    borderColor: '#e53924',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  checkInToggleOpen: { backgroundColor: '#fdecea' },
  checkInToggleText: { color: '#e53924', fontWeight: '800', fontSize: 13 },
  checkInBlock: { marginTop: 10 },
  inboxButton: { width: '100%', maxWidth: 520, minHeight: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20, flexDirection: 'row', gap: 8, backgroundColor: '#FFF' },
  inboxText: { fontWeight: 'bold', fontSize: 16 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  logout: { width: '100%', maxWidth: 520, height: 50, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  logoutText: { fontWeight: 'bold', fontSize: 16 },
});
