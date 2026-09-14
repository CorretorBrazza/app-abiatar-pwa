import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ChevronRight,
  Clock3,
  Crosshair,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Target,
  UserCheck,
  Users,
  X,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api, { apiBaseUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateEmpty, StateError, StateOffline, StaleBanner } from './components/States';
import type { NovaView } from './workspaces';

const spTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const kpi = [
  { key: 'booths', label: 'Plantões atribuídos', tone: 'action' as const, icon: UserCheck },
  { key: 'online', label: 'Corretores online', tone: 'positive' as const, icon: Users },
  { key: 'queue', label: 'Pessoas na fila', tone: 'info' as const, icon: Crosshair },
  { key: 'unread', label: 'Mensagens não lidas', tone: 'attention' as const, icon: MessageSquare },
];

export default function NovaReception({
  view,
  onOpen,
  isMobile,
}: {
  view: NovaView;
  onOpen: (v: NovaView) => void;
  isMobile?: boolean;
}) {
  const { user } = useAuth();
  const [booths, setBooths] = useState<any[]>([]);
  const [queues, setQueues] = useState<Record<string, any>>({});
  const [operationalTargets, setOperationalTargets] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [checkInOpenBooth, setCheckInOpenBooth] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [attendTarget, setAttendTarget] = useState<{
    presenceId: string;
    nomeGuerra: string;
    isNext: boolean;
    tipo: 'vez' | 'agendamento' | 'retorno';
  } | null>(null);
  const [cliente, setCliente] = useState({ nome: '', telefone: '', email: '' });
  const [confirming, setConfirming] = useState(false);

  const loadOperationalData = async () => {
    try {
      const [boothsResult, targetsResult, brokersResult] = await Promise.allSettled([
        api.get('/booths/assigned'),
        api.get('/notifications/operational/targets'),
        api.get('/users/reception-brokers'),
      ]);

      const assignedBooths =
        boothsResult.status === 'fulfilled' && Array.isArray(boothsResult.value.data)
          ? boothsResult.value.data
          : [];
      const operationalTargetsData =
        targetsResult.status === 'fulfilled' && Array.isArray(targetsResult.value.data)
          ? targetsResult.value.data
          : [];
      const brokersData =
        brokersResult.status === 'fulfilled' && Array.isArray(brokersResult.value.data)
          ? brokersResult.value.data
          : [];

      for (const r of [boothsResult, targetsResult, brokersResult]) {
        if (r.status === 'rejected') {
          console.warn('[NOVARECEPTION] Falha em chamada de operação:', r.reason);
        }
      }

      const queueByBooth: Record<string, any> = {};
      await Promise.all(
        assignedBooths.map(async (booth: any) => {
          if (booth?.id) {
            try {
              const queueResponse = await api.get(`/presences/booths/${booth.id}/queue`);
              if (queueResponse.data) queueByBooth[booth.id] = queueResponse.data;
            } catch (error) {
              console.warn(`[NOVARECEPTION] Falha ao carregar a fila do plantão ${booth.id}:`, error);
            }
          }
        }),
      );

      setBooths(assignedBooths);
      setQueues(queueByBooth);
      setOperationalTargets(operationalTargetsData);
      setBrokers(brokersData);
      setOnline(boothsResult.status === 'fulfilled');
      if (boothsResult.status === 'fulfilled') {
        setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (error) {
      console.error('[NOVARECEPTION] Falha ao atualizar operação:', error);
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    void loadOperationalData();
    const connectRealtime = async () => {
      const token = await AsyncStorage.getItem('@abiatar:token');
      if (!token || cancelled || typeof fetch === 'undefined') return;
      try {
        const response = await fetch(`${apiBaseUrl}/realtime/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.replace(/^data:\s*/, ''));
              if (
                event.eventType?.startsWith('presence.') ||
                event.eventType?.startsWith('roleta.') ||
                event.eventType?.includes('created') ||
                event.eventType?.includes('updated') ||
                event.eventType?.startsWith('message.')
              ) {
                void loadOperationalData();
              }
            } catch {
              /* heartbeat */
            }
          }
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connectRealtime, 5000);
      }
    };
    void connectRealtime();
    const fallbackIntervalId = setInterval(() => void loadOperationalData(), 15000);
    return () => {
      cancelled = true;
      clearInterval(fallbackIntervalId);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [refreshKey]);

  useEffect(() => {
    let mounted = true;
    const loadUnreadCount = async () => {
      try {
        const response = await api.get('/messages/my-inbox');
        if (mounted) setUnreadCount(Array.isArray(response.data) ? response.data.filter((item: any) => !item.read_at).length : 0);
      } catch (error) {
        console.warn('[NOVARECEPTION] Falha ao atualizar mensagens não lidas:', error);
      }
    };
    loadUnreadCount();
    const intervalId = setInterval(loadUnreadCount, 15000);
    const handlePush = () => loadUnreadCount();
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:push', handlePush);
    }
    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:push', handlePush);
      }
    };
  }, []);

  const runAction = async (promise: Promise<any>, busyKey: string) => {
    setActionBusy(busyKey);
    try {
      const response = await promise;
      alert(response.data.message || 'Ação registrada.');
      void loadOperationalData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Não foi possível concluir a ação.');
    } finally {
      setActionBusy(null);
    }
  };

const openAttend = (item: any, isNext: boolean) => {
    setCliente({ nome: '', telefone: '', email: '' });
    setAttendTarget({
      presenceId: item.presenceId,
      nomeGuerra: item.nomeGuerra,
      isNext,
      tipo: isNext ? 'vez' : 'agendamento',
    });
  };

  const confirmAttend = async () => {
    if (!attendTarget) return;
    setConfirming(true);
    try {
      const payload: Record<string, unknown> = {};
      if (attendTarget.tipo !== 'vez') payload.tipo = attendTarget.tipo;
      const c = {
        nome: cliente.nome.trim() || undefined,
        telefone: cliente.telefone.trim() || undefined,
        email: cliente.email.trim() || undefined,
      };
      if (c.nome || c.telefone || c.email) payload.cliente = c;
      const url = attendTarget.isNext
        ? `/presences/attend-vez/${attendTarget.presenceId}`
        : `/presences/attend/${attendTarget.presenceId}`;
      const response = await api.post(url, payload);
      alert(response.data.message || 'Atendimento registrado.');
      setAttendTarget(null);
      void loadOperationalData();
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Não foi possível concluir o atendimento.');
    } finally {
      setConfirming(false);
    }
  };

  const handleReceptionCheckout = (presenceId: string, nomeGuerra: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Confirmar que '${nomeGuerra}' SAÍU do plantão? A recepção é soberana: a presença será encerrada e ele sai da sequência de atendimento.`,
      )
    )
      return;
    void runAction(api.post(`/presences/reception-checkout/${presenceId}`), presenceId);
  };

  const handleRevalidate = (presenceId: string, nomeGuerra: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`Revalidar a presença de '${nomeGuerra}'? A posição na fila será mantida.`)) return;
    void runAction(api.post('/presences/force-validate', { presenceId }), presenceId);
  };

  const handleForceCheckIn = (brokerId: string, nomeGuerra: string, booth: any) => {
    if (typeof window !== 'undefined' && !window.confirm(`Efetuar check-in de '${nomeGuerra}' neste plantão (${booth.name})? O check-in precisa estar dentro da janela da roleta atual.`)) return;
    void runAction(api.post('/presences/force-check-in', { brokerId, boothId: booth.id }), brokerId);
    setCheckInOpenBooth(null);
  };

  if (loading && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={3} height={120} />
        <SkeletonBlock lines={2} height={150} />
      </ScrollView>
    );
  }

  if (!online && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError message="Não foi possível conectar à operação. Verifique sua conexão." onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />
      </ScrollView>
    );
  }

  if (booths.length === 0) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateEmpty
          title="Nenhum plantão atribuído"
          message="A Diretoria ainda não vinculou esta recepção a um plantão. Quando houver uma atribuição, o acompanhamento operacional aparecerá aqui."
          tone="neutral"
        />
      </ScrollView>
    );
  }

  if (view === 'operation') {
    return (
      <>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}
        <View style={styles.rowSpace}>
          <View>
            <Text style={fonts.h1Mobile}>Fila de atendimento</Text>
            <Text style={styles.subtitle}>Convoque o próximo da fila e mantenha os plantões em movimento.</Text>
          </View>
          <TouchableOpacity style={styles.backChip} onPress={() => onOpen('command')}>
            <LayoutDashboard size={13} color={colors.slate600} />
            <Text style={styles.backChipText}>Visão geral</Text>
          </TouchableOpacity>
        </View>
        {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}

        {booths.map((booth) => {
          const onlineTargets = operationalTargets.filter((target) => target.boothId === booth.id);
          const boothQueue = queues[booth.id] || null;
          return (
            <View key={booth.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={fonts.panelTitle}>{booth.name}</Text>
                  <View style={styles.cardMetaRow}>
                    <MapPin size={11} color={colors.slate500} />
                    <Text style={styles.cardMeta}>{booth.address}</Text>
                  </View>
                </View>
                <View style={[styles.chip, { backgroundColor: statusTone[onlineTargets.length > 0 ? 'positive' : 'neutral'].bg }]}>
                  <View style={[styles.chipDot, { backgroundColor: statusTone[onlineTargets.length > 0 ? 'positive' : 'neutral'].dot }]} />
                  <Text style={[styles.chipText, { color: statusTone[onlineTargets.length > 0 ? 'positive' : 'neutral'].fg }]}>
                    {onlineTargets.length > 0 ? `${onlineTargets.length} online` : 'offline'}
                  </Text>
                </View>
              </View>

              {boothQueue?.currentRoleta ? (
                <View style={styles.roletaWrap}>
                  <View style={styles.roletaHead}>
                    <View>
                      <Text style={styles.roletaLabel}>Roleta do momento</Text>
                      <Text style={styles.roletaName}>{boothQueue.currentRoleta.name}</Text>
                    </View>
                    <View style={styles.roletaSide}>
                      <Text style={styles.roletaTime}>
                        <Clock3 size={11} color={colors.slate500} /> sorteio {boothQueue.currentRoleta.drawTimeFormatted}
                      </Text>
                      {boothQueue.currentRoleta.phase === 'aguardando_sorteio' && (
                        <Text style={[styles.roletaWait, { color: colors.amber700 }]}>aguardando sorteio</Text>
                      )}
                      {boothQueue.currentRoleta.phase === 'apos_sorteio' && (
                        <Text style={[styles.roletaWait, { color: colors.green700 }]}>sorteio realizado · sequência da roleta</Text>
                      )}
                    </View>
                  </View>

                  {boothQueue.queue.length === 0 ? (
                    <Text style={styles.queueEmpty}>Fila vazia na roleta atual.</Text>
                  ) : (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {boothQueue.queue.map((item: any, index: number) => {
                        const isNext = item.isFirst === true;
                        const busy = actionBusy === item.presenceId;
                        return (
                          <View key={item.presenceId}>
                            <View style={[styles.queueItem, isNext && styles.queueItemNext]}>
                              <View style={styles.queueBadge}>
                                <Text style={[styles.queuePos, { color: statusTone[isNext ? 'positive' : 'neutral'].fg }]}>
                                  #{index + 1}
                                </Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.nameRow}>
                                  <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                                  {isNext && (
                                    <View style={styles.nextChip}>
                                      <Text style={styles.nextChipText}>PRÓXIMO</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={styles.queueInline}>
                                  <View style={[styles.entryBadge, { backgroundColor: item.roletaEntryType === 'pos_barra' ? colors.amber700 : colors.green700 }]}>
                                    <Text style={styles.entryBadgeText}>
                                      {item.roletaEntryType === 'pos_barra' ? 'PÓS-BARRA' : 'PONTUAL'}
                                    </Text>
                                  </View>
                                  <Text style={styles.queueMeta}>
                                    Entrada {spTime(item.checkInAt)} · {item.minutesActive} min ativo
                                  </Text>
                                </View>
                                <Text style={styles.queueMeta}>
                                  {item.roletaEntryType === 'pos_barra' ? `Posição ${item.roletaPosition}º` : `Sorteado ${item.roletaPosition}º`}
                                </Text>
                              </View>
                              {isNext ? (
                                <View style={styles.actionsCol}>
                                  <TouchableOpacity
                                    style={[styles.vezBtn, busy && styles.btnBusy]}
                                    disabled={busy}
                                    onPress={() => openAttend(item, true)}
                                  >
                                    <Text style={styles.attendBtnText}>{busy ? '...' : 'Atender vez'}</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.attendBtn, busy && styles.btnBusy]}
                                    disabled={busy}
                                    onPress={() => openAttend(item, false)}
                                  >
                                    <Text style={styles.attendBtnText}>{busy ? '...' : 'Atender'}</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[styles.attendBtn, busy && styles.btnBusy]}
                                  disabled={busy}
                                  onPress={() => openAttend(item, false)}
                                >
                                  <Text style={styles.attendBtnText}>{busy ? '...' : 'Atender'}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <TouchableOpacity
                              style={styles.checkOutLink}
                              onPress={() => handleReceptionCheckout(item.presenceId, item.nomeGuerra)}
                            >
                              <LogOut size={11} color={colors.slate500} />
                              <Text style={styles.checkOutLinkText}>Saiu do plantão (check-out soberano)</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {boothQueue.awaitingRevalidation?.length > 0 && (
                    <View style={styles.absentBlock}>
                      <Text style={styles.absentTitle}>Presenças suspensas aguardando revalidação</Text>
                      {boothQueue.awaitingRevalidation.map((item: any) => (
                        <View key={item.presenceId} style={[styles.queueItem, styles.revalItem]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>
                              Entrada {spTime(item.checkInAt)} · Posição {item.roletaPosition ? `${item.roletaPosition}º mantida` : 'aguardando sorteio'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.revalBtn, actionBusy === item.presenceId && styles.btnBusy]}
                            disabled={actionBusy === item.presenceId}
                            onPress={() => handleRevalidate(item.presenceId, item.nomeGuerra)}
                          >
                            <Text style={styles.attendBtnText}>{actionBusy === item.presenceId ? '...' : 'Revalidar'}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {boothQueue.outOfWindow?.length > 0 && (
                    <View style={styles.absentBlock}>
                      <Text style={styles.outWindowTitle}>Fora da janela da roleta · período não será validado</Text>
                      {boothQueue.outOfWindow.map((item: any) => (
                        <View key={item.presenceId} style={[styles.queueItem, styles.revalItem]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>
                              Entrada {spTime(item.checkInAt)} · {item.minutesActive} min ativo · sem posição e sem validação
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.attendBtn, actionBusy === item.presenceId && styles.btnBusy]}
                            disabled={actionBusy === item.presenceId}
                            onPress={() => openAttend(item, false)}
                          >
                            <Text style={styles.attendBtnText}>{actionBusy === item.presenceId ? '...' : 'Atender'}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.noRoleta}>Nenhuma roleta em andamento neste momento.</Text>
              )}

              <TouchableOpacity
                style={[styles.checkInToggle, checkInOpenBooth === booth.id && styles.checkInToggleOpen]}
                onPress={() => setCheckInOpenBooth(checkInOpenBooth === booth.id ? null : booth.id)}
              >
                <UserCheck size={14} color={colors.coral600} />
                <Text style={styles.checkInToggleText}>
                  {checkInOpenBooth === booth.id ? 'Fechar check-in manual' : 'Efetuar check-in de corretor'}
                </Text>
              </TouchableOpacity>

              {checkInOpenBooth === booth.id && (
                <View style={styles.checkInBlock}>
                  {brokers.length === 0 ? (
                    <Text style={styles.queueMeta}>Nenhum corretor cadastrado encontrado.</Text>
                  ) : (
                    brokers.map((brokerItem: any) => {
                      const busy = brokerItem.activePresence !== null;
                      const unavailable = busy || brokerItem.stageExpired === true;
                      return (
                        <View key={brokerItem.id} style={[styles.queueItem, styles.revalItem]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.queueName}>{brokerItem.nomeGuerra}</Text>
                            <Text style={styles.queueMeta}>
                              {busy
                                ? 'Já em turno'
                                : brokerItem.activePresence?.status === 'absent'
                                  ? 'Turno suspenso (ausência)'
                                  : brokerItem.stageExpired === true
                                    ? 'Estágio expirado'
                                    : 'Disponível'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.attendBtn, unavailable && styles.btnBusy]}
                            disabled={unavailable || actionBusy === brokerItem.id}
                            onPress={() => handleForceCheckIn(brokerItem.id, brokerItem.nomeGuerra, booth)}
                          >
                            <Text style={styles.attendBtnText}>{actionBusy === brokerItem.id ? '...' : 'Check-in'}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footNote}>Atualização em tempo real; consulta de segurança a cada 15 segundos.</Text>
      </ScrollView>

      {attendTarget && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setAttendTarget(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modalTitle}>Atendimento · {attendTarget.nomeGuerra}</Text>
                  <Text style={styles.modalSub}>
                    {attendTarget.isNext
                      ? 'Da vez da roleta — após atender, ele volta para o final da fila.'
                      : 'Atendimento de corretor específico — ele sai da sequência de atendimento.'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={() => setAttendTarget(null)}>
                  <X size={16} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {!attendTarget.isNext && (
                <>
                  <Text style={styles.modalLabel}>Tipo de atendimento</Text>
                  <View style={styles.tipoRow}>
                    {(['agendamento', 'retorno'] as const).map((t) => {
                      const selected = attendTarget.tipo === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.tipoOption, selected && styles.tipoSelected]}
                          activeOpacity={0.85}
                          onPress={() => setAttendTarget((cur) => (cur ? { ...cur, tipo: t } : cur))}
                        >
                          <Text style={[styles.tipoOptionText, selected && styles.tipoSelectedText]}>
                            {t === 'agendamento' ? 'Agendamento' : 'Retorno'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.modalLabel}>Dados do cliente (opcional — enviados ao CRM)</Text>
              <View style={styles.modalInputs}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nome do cliente"
                  placeholderTextColor={colors.slate400}
                  value={cliente.nome}
                  onChangeText={(v) => setCliente((c) => ({ ...c, nome: v }))}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Telefone"
                  placeholderTextColor={colors.slate400}
                  value={cliente.telefone}
                  onChangeText={(v) => setCliente((c) => ({ ...c, telefone: v }))}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Email"
                  placeholderTextColor={colors.slate400}
                  value={cliente.email}
                  onChangeText={(v) => setCliente((c) => ({ ...c, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.tipoOption, { flex: 1, borderColor: colors.slate200 }]}
                  onPress={() => setAttendTarget(null)}
                  disabled={confirming}
                >
                  <Text style={styles.tipoOptionText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.attendBtn, { flex: 2, backgroundColor: attendTarget.tipo === 'vez' ? colors.green700 : colors.navy800 }, confirming && styles.btnBusy]}
                  disabled={confirming}
                  onPress={confirmAttend}
                >
                  <Text style={styles.attendBtnText}>
                    {confirming
                      ? 'Registrando...'
                      : attendTarget.tipo === 'vez'
                        ? 'Confirmar atendimento da vez'
                        : `Confirmar ${attendTarget.tipo === 'agendamento' ? 'Agendamento' : 'Retorno'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      </>
    );
  }

  const totalOnline = operationalTargets.length;
  const totalQueue = Object.values(queues).reduce(
    (sum, q: any) => sum + (q?.currentRoleta ? (Array.isArray(q.queue) ? q.queue.length : 0) : 0),
    0,
  );
  const kpiValues: Record<string, string | number> = {
    booths: booths.length,
    online: totalOnline,
    queue: totalQueue,
    unread: unreadCount > 9 ? '9+' : unreadCount,
  };

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View
          style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Target size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>Recepção · Operação ao vivo</Text>
            </View>
            <View style={styles.heroLive}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveText}>AO VIVO</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{user?.nome_guerra ? `Olá, ${user.nome_guerra}.` : 'Olá.'}</Text>
          <Text style={styles.heroSubtitle}>Cockpit do plantão — acompanhe os plantões atribuídos e a fila de atendimento.</Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpi.map((k) => {
            const t = statusTone[k.tone];
            const Icon = k.icon;
            return (
              <View key={k.key} style={[styles.kpiCard, { width: isMobile ? '48%' : '23%' }]}>
                <View style={[styles.kpiIcon, { backgroundColor: t.bg }]}>
                  <Icon size={16} color={t.fg} />
                </View>
                <Text style={fonts.metricValueMobile}>{kpiValues[k.key]}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={fonts.panelTitle}>Plantões atribuídos</Text>
            <Text style={styles.sectionSub}>Toque em um plantão para abrir a fila de atendimento.</Text>
          </View>
          <TouchableOpacity style={styles.gotoAll} onPress={() => onOpen('operation')}>
            <Text style={styles.gotoAllText}>Ver fila</Text>
            <ChevronRight size={14} color={colors.coral600} />
          </TouchableOpacity>
        </View>

        <View style={styles.boothList}>
          {booths.map((booth) => {
            const onlineTargets = operationalTargets.filter((target) => target.boothId === booth.id);
            const boothQueue = queues[booth.id] || null;
            const qLen = boothQueue?.currentRoleta && Array.isArray(boothQueue.queue) ? boothQueue.queue.length : 0;
            const isOnline = onlineTargets.length > 0;
            return (
              <TouchableOpacity key={booth.id} style={styles.boothCard} onPress={() => onOpen('operation')} activeOpacity={0.85}>
                <View style={styles.boothCardGrow}>
                  <Text style={styles.boothName}>{booth.name}</Text>
                  <View style={styles.cardMetaRow}>
                    <MapPin size={11} color={colors.slate500} />
                    <Text style={styles.cardMeta} numberOfLines={1}>{booth.address}</Text>
                  </View>
                  <View style={styles.boothStatusRow}>
                    <View style={[styles.chip, { backgroundColor: statusTone[isOnline ? 'positive' : 'neutral'].bg }]}>
                      <View style={[styles.chipDot, { backgroundColor: statusTone[isOnline ? 'positive' : 'neutral'].dot }]} />
                      <Text style={[styles.chipText, { color: statusTone[isOnline ? 'positive' : 'neutral'].fg }]}>
                        {isOnline ? `${onlineTargets.length} online` : 'offline'}
                      </Text>
                    </View>
                    <Text style={styles.boothQueueCount}>
                      {boothQueue?.currentRoleta ? `${qLen} na fila` : 'sem roleta'}
                    </Text>
                  </View>
                </View>
                <View style={styles.boothArrow}>
                  <ChevronRight size={17} color={colors.slate500} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  rowSpace: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  subtitle: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 2 },
  backChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.slate100,
  },
  backChipText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  hero: {
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroLive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.coral500 },
  heroLiveText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 9.5, letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 24, letterSpacing: -0.8, marginTop: 18 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 6, ...shadow.card,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '500', fontSize: 10.5, lineHeight: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  gotoAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  gotoAllText: { color: colors.coral600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  boothList: { gap: 10 },
  boothCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, ...shadow.card,
  },
  boothCardGrow: { flex: 1, minWidth: 0, gap: 5 },
  boothName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 13.5 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, flexShrink: 1 },
  boothStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  boothQueueCount: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 10.5 },
  boothArrow: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.slate050, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: font.body, fontWeight: '700', fontSize: 9.5 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  roletaWrap: { borderTopWidth: 1, borderTopColor: semantic.divider, paddingTop: 12, gap: 10 },
  roletaHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  roletaLabel: { color: colors.slate500, fontFamily: font.body, fontWeight: '700', fontSize: 9.5, letterSpacing: 1.4, textTransform: 'uppercase' },
  roletaName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 15, marginTop: 3 },
  roletaSide: { alignItems: 'flex-end', gap: 3 },
  roletaTime: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  roletaWait: { fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  queueEmpty: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic' },
  queueItem: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 11,
  },
  queueItemNext: { borderColor: colors.green700, backgroundColor: colors.green100 },
  queueBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: semantic.card, alignItems: 'center', justifyContent: 'center' },
  queuePos: { fontFamily: font.display, fontWeight: '800', fontSize: 12.5 },
  queueName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13 },
  queueInline: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  entryBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  entryBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  queueMeta: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '400', fontSize: 10.5, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nextChip: {
    backgroundColor: colors.green100, borderWidth: 1, borderColor: colors.green700, borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  nextChipText: { color: colors.green700, fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  attendBtn: {
    backgroundColor: colors.navy800, borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 9, minHeight: 36, justifyContent: 'center',
  },
  actionsCol: { gap: 6 },
  vezBtn: { backgroundColor: colors.green700, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9, justifyContent: 'center' },
  attendBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  btnBusy: { opacity: 0.5 },
  absentBlock: { borderTopWidth: 1, borderTopColor: semantic.divider, paddingTop: 12, gap: 8 },
  absentTitle: { color: colors.amber700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  outWindowTitle: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  revalItem: { backgroundColor: semantic.card },
  revalBtn: { backgroundColor: colors.amber700, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 9 },
  noRoleta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5 },
  checkInToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: colors.coral600, borderStyle: 'dashed', borderRadius: radius.md,
    paddingVertical: 10,
  },
  checkInToggleOpen: { backgroundColor: colors.coral050 },
  checkInToggleText: { color: colors.coral600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  checkInBlock: { gap: 8 },
  footNote: { color: semantic.textFaint, fontFamily: font.body, fontSize: 10, textAlign: 'center', marginTop: 4 },
  checkOutLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, paddingTop: 6, paddingHorizontal: 4 },
  checkOutLinkText: { color: colors.slate500, fontFamily: font.body, fontWeight: '600', fontSize: 10 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(10,16,24,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 460,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 20, gap: 14, ...shadow.card,
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  modalSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, lineHeight: 16, marginTop: 3 },
  modalClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  modalLabel: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoOption: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.slate050,
  },
  tipoSelected: { borderColor: colors.green700, backgroundColor: colors.green100 },
  tipoOptionText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  tipoSelectedText: { color: colors.green700 },
  modalInputs: { gap: 8 },
  modalInput: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    backgroundColor: colors.slate050,
    paddingHorizontal: 12, paddingVertical: 10,
    color: semantic.textPrimary, fontFamily: font.body, fontSize: 12.5,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 2 },
});