import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  Crosshair,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone, StateTone } from './tokens';
import { SkeletonBlock, StateError, StateOffline, StaleBanner } from './components/States';

const spTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const dateInTz = (d: Date, tz = 'America/Sao_Paulo'): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

function stageBadge(stage?: string): { label: string; tone: StateTone } {
  if (stage === 'corretor_creci') return { label: 'CRECI', tone: 'positive' };
  if (stage === 'estagiario') return { label: 'Estagiário', tone: 'attention' };
  if (stage === 'treinamento') return { label: 'Treinamento', tone: 'info' };
  return { label: 'Corretor', tone: 'action' };
}

function boothTone(data: any): { tone: StateTone; text: string } {
  if (data.onlineCount === 0) return { tone: 'danger', text: 'Vazio' };
  if (data.isUnderstaffed) return { tone: 'attention', text: `Baixa cobertura (${data.onlineCount}/${data.minRequired})` };
  return { tone: 'positive', text: `Coberto (${data.onlineCount} corretores)` };
}

export default function NovaCommandCenter({
  isMobile,
  nickname,
}: {
  isMobile?: boolean;
  nickname?: string;
}) {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [attSummary, setAttSummary] = useState<any>(null);
  const [attendancesCopying, setAttendancesCopying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attError, setAttError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = dateInTz(new Date());
      const res = await api.get('/presences/reports/realtime');
      let attRes: any = null;
      try {
        attRes = await api.get('/presences/reports/attendance-summary', {
          params: { startDate: today, endDate: today },
        });
        setAttError(false);
      } catch {
        setAttError(true);
      }
      setData(res.data);
      setAttSummary(attRes?.data ?? null);
      setOnline(true);
      setError(false);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('[COMMAND] Falha ao atualizar comando operacional:', error);
      setOnline(false);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadData();
    const handleRealtime = () => { if (!cancelled) void loadData(true); };
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:realtime', handleRealtime);
      window.addEventListener('abiatar:booth_update', handleRealtime);
    }
    const intervalId = setInterval(() => void loadData(true), 15000);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:realtime', handleRealtime);
        window.removeEventListener('abiatar:booth_update', handleRealtime);
      }
      clearInterval(intervalId);
    };
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadData(true);
  };

  const handleCopySummary = async () => {
    if (!data) return;
    let text = `🏢 *RESUMO EXECUTIVO - ${tenant?.name || 'ABIATAR'}*\n`;
    text += `📅 ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\n`;
    text += `📍 *OPERAÇÃO EM TEMPO REAL:*\n`;
    text += `• Plantões Cobertos: ${data.activeBoothsCount} de ${data.totalBooths}\n`;
    text += `• Força de Vendas Online: ${data.onlineBrokersCount} corretores nos estandes\n`;
    text += `• Roletas Realizadas Hoje: ${data.todayCheckinsCount}\n`;
    text += `• Horas de Plantão Hoje: ${data.todayTotalHoursFormatted}\n`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert('Resumo executivo copiado para a área de transferência! Pronto para colar no WhatsApp.');
    } else {
      alert('Resumo executivo gerado com sucesso.');
    }
  };

  const handleCopyAttendances = async () => {
    if (!attSummary || attError) return;
    setAttendancesCopying(true);
    try {
      const perBooth: any[] = attSummary.perBooth || [];
      const totals = attSummary.totals || { vez: 0, agendamento: 0, retorno: 0, total: 0 };
      let text = `🗂 *ATENDIMENTOS DE HOJE* — ${tenant?.name || 'ABIATAR'}\n`;
      text += `📅 ${dateInTz(new Date())}\n\n`;
      if (perBooth.length === 0) text += `• Nenhum atendimento registrado hoje.\n`;
      perBooth.forEach((b) => {
        text += `• ${b.boothName}: Vez ${b.vez} · Agendamento ${b.agendamento} · Retorno ${b.retorno} (total ${b.total})\n`;
      });
      text += `\n*Totais:* Vez ${totals.vez} · Agendamento ${totals.agendamento} · Retorno ${totals.retorno} · Geral ${totals.total}\n`;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Atendimentos de hoje copiados! Pronto para colar no WhatsApp.');
      } else {
        alert('Resumo de atendimentos gerado com sucesso.');
      }
    } finally {
      setAttendancesCopying(false);
    }
  };

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading && !data) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={140} />
        <View style={styles.kpiGrid}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.kpiSkeleton, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]} />
          ))}
        </View>
        <SkeletonBlock lines={2} height={220} />
      </ScrollView>
    );
  }

  if (error && !data) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError message="Não foi possível carregar o status operacional ao vivo." onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />
      </ScrollView>
    );
  }

  const kpis = [
    {
      label: 'Plantões cobertos',
      value: `${data?.activeBoothsCount ?? 0}`,
      sub:
        data?.emptyBoothsCount > 0
          ? `${data.emptyBoothsCount} sem corretor`
          : `de ${data?.totalBooths ?? 0} plantões`,
      tone: (data?.emptyBoothsCount ?? 0) > 0 ? ('danger' as const) : ('positive' as const),
      icon: CheckCircle2,
    },
    {
      label: 'Corretores online',
      value: `${data?.onlineBrokersCount ?? 0}`,
      sub: 'Força de vendas nos estandes',
      tone: 'info' as const,
      icon: Users,
    },
    {
      label: 'Roletas do dia',
      value: `${data?.todayCheckinsCount ?? 0}`,
      sub: 'Check-ins realizados hoje',
      tone: 'action' as const,
      icon: Crosshair,
    },
    {
      label: 'Horas cumpridas hoje',
      value: data?.todayTotalHoursFormatted ?? '0h',
      sub: 'Tempo presencial validado',
      tone: 'attention' as const,
      icon: Timer,
    },
    {
      label: 'Desconsideradas hoje',
      value: `${data?.invalidatedBrokersCount ?? 0}`,
      sub: 'Presenças descartadas',
      tone: (data?.invalidatedBrokersCount ?? 0) > 0 ? ('danger' as const) : ('neutral' as const),
      icon: Ban,
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <ShieldCheck size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>Command Center · Operação ao vivo</Text>
            </View>
            <View style={styles.heroLive}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveText}>AO VIVO</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{user?.nome_guerra ? `${user.nome_guerra},` : ''} acompanhe a operação.</Text>
          <Text style={styles.heroSubtitle}>{tenant?.name || 'ABIATAR'} · {today}</Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => {
            const t = statusTone[k.tone];
            const Icon = k.icon;
            return (
              <View key={k.label} style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: t.bg }]}>
                  <Icon size={16} color={t.fg} />
                </View>
                <Text style={fonts.metricValueMobile}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
                <Text numberOfLines={1} style={[styles.kpiSub, { color: t.fg }]}>{k.sub}</Text>
              </View>
            );
          })}
        </View>

        {(data?.emptyBoothsCount ?? 0) > 0 && (
          <View style={styles.alertBanner}>
            <AlertTriangle size={15} color={colors.red700} />
            <Text style={styles.alertBannerText}>
              {data.emptyBoothsCount} estande(s) sem corretor no momento. Priorize o envio de força de vendas.
            </Text>
          </View>
        )}

        <View style={styles.sectionHead}>
          <View>
            <Text style={fonts.panelTitle}>Plantões & presenças ativas</Text>
            <Text style={styles.sectionSub}>Status por estande, atualizado em tempo real.</Text>
          </View>
          <View style={styles.headActions}>
            <TouchableOpacity style={styles.copyBtn} onPress={() => void handleCopySummary()} accessibilityLabel="Copiar resumo executivo">
              <Copy size={13} color={colors.slate600} />
              <Text style={styles.copyBtnText}>Copiar resumo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing} accessibilityLabel="Atualizar agora">
              <RefreshCw size={13} color={refreshing ? colors.slate500 : colors.coral600} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.boothList}>
          {data?.booths?.map((booth: any) => {
            const status = boothTone(booth);
            const st = statusTone[status.tone];
            return (
              <View key={booth.boothId} style={styles.boothCard}>
                <View style={styles.boothHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.boothName}>{booth.boothName}</Text>
                    <View style={styles.cardMetaRow}>
                      <MapPin size={11} color={colors.slate500} />
                      <Text style={styles.cardMeta} numberOfLines={1}>{booth.address || 'Endereço cadastrado'}</Text>
                    </View>
                  </View>
                  <View style={[styles.chip, { backgroundColor: st.bg }]}>
                    <View style={[styles.chipDot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.chipText, { color: st.fg }]}>{status.text}</Text>
                  </View>
                </View>

                {booth.onlineBrokers.length === 0 ? (
                  <Text style={styles.emptyBooth}>Nenhum corretor com check-in ativo neste estande no momento.</Text>
                ) : (
                  <View style={styles.brokerList}>
                    {booth.onlineBrokers.map((broker: any) => {
                      const badge = stageBadge(broker.brokerStage);
                      const bt = statusTone[badge.tone];
                      return (
                        <View key={broker.presenceId} style={styles.brokerItem}>
                          <View style={styles.posBadge}>
                            <Text style={styles.posText}>#{broker.roletaPosition || '-'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.brokerNameRow}>
                              <Text style={styles.brokerName}>{broker.nomeGuerra}</Text>
                              <View style={[styles.stageBadge, { backgroundColor: bt.bg }]}>
                                <Text style={[styles.stageBadgeText, { color: bt.fg }]}>{badge.label}</Text>
                              </View>
                            </View>
                            <View style={styles.brokerMetaRow}>
                              <Text style={styles.brokerMeta} numberOfLines={1}>
                                {broker.roletaName} · Entrada {spTime(broker.checkInAt)} · {broker.minutesActive ?? 0} min
                              </Text>
                              <View style={[styles.entryBadge, { backgroundColor: broker.roletaEntryType === 'pos_barra' ? colors.amber700 : colors.green700 }]}>
                                <Text style={styles.entryBadgeText}>
                                  {broker.roletaEntryType === 'pos_barra' ? 'PÓS-BARRA' : 'PONTUAL'}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.timeBox}>
                            <Clock3 size={11} color={colors.slate600} />
                            <Text style={styles.timeText}>{broker.hoursFormatted}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {booth.invalidatedBrokers?.length > 0 && (
                  <View style={styles.invalidatedBlock}>
                    <Text style={styles.invalidatedTitle}>Desconsideradas hoje — {booth.invalidatedBrokers.length}</Text>
                    <View style={styles.brokerList}>
                      {booth.invalidatedBrokers.map((broker: any) => (
                        <View key={broker.presenceId} style={[styles.brokerItem, styles.invalidatedItem]}>
                          <View style={[styles.posBadge, styles.posBadgeWarn]}>
                            <Text style={styles.posText}>#{broker.roletaPosition || '-'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.brokerName, { color: colors.amber700 }]}>{broker.nomeGuerra}</Text>
                            <Text style={styles.brokerMeta}>
                              {broker.roletaName} · Entrada {spTime(broker.checkInAt)} · {spTime(broker.invalidatedAt)}
                            </Text>
                          </View>
                          <View style={[styles.entryBadge, { backgroundColor: colors.amber700 }]}>
                            <Text style={styles.entryBadgeText}>DESCONSIDERADA</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.attSection}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={fonts.panelTitle}>Atendimentos de hoje</Text>
              <Text style={styles.sectionSub}>Vez · Agendamento · Retorno por plantão.</Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => void handleCopyAttendances()}
              disabled={attendancesCopying || !attSummary || attError}
              accessibilityLabel="Copiar atendimentos de hoje"
            >
              <Copy size={13} color={attendancesCopying || !attSummary || attError ? colors.slate300 : colors.slate600} />
              <Text style={styles.copyBtnText}>{attendancesCopying ? 'Copiando...' : 'Copiar'}</Text>
            </TouchableOpacity>
          </View>

          {attError ? (
            <View style={styles.attErrorBox}>
              <AlertTriangle size={15} color={colors.red700} />
              <View style={{ flex: 1 }}>
                <Text style={styles.attErrorText}>Não foi possível carregar os atendimentos de hoje.</Text>
              </View>
              <TouchableOpacity style={styles.attErrorRetry} onPress={() => { setLoading(true); setRefreshKey((k) => k + 1); }}>
                <Text style={styles.attErrorRetryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : attSummary?.perBooth?.length ? (
            <View style={styles.attGrid}>
              {attSummary.perBooth.map((b: any) => (
                <View key={b.boothId} style={styles.attCard}>
                  <Text style={styles.attBooth} numberOfLines={1}>{b.boothName}</Text>
                  <View style={styles.attCells}>
                    <View style={[styles.attCell, { backgroundColor: statusTone.positive.bg }]}>
                      <Text style={[styles.attVal, { color: colors.green700 }]}>{b.vez}</Text>
                      <Text style={styles.attLabel}>Vez</Text>
                    </View>
                    <View style={[styles.attCell, { backgroundColor: statusTone.info.bg }]}>
                      <Text style={[styles.attVal, { color: colors.navy800 }]}>{b.agendamento}</Text>
                      <Text style={styles.attLabel}>Agend.</Text>
                    </View>
                    <View style={[styles.attCell, { backgroundColor: statusTone.attention.bg }]}>
                      <Text style={[styles.attVal, { color: colors.amber700 }]}>{b.retorno}</Text>
                      <Text style={styles.attLabel}>Retorno</Text>
                    </View>
                    <View style={styles.attCell}>
                      <Text style={[styles.attVal, { color: semantic.textPrimary }]}>{b.total}</Text>
                      <Text style={styles.attLabel}>Total</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noAttBox}>
              <Text style={styles.noAttText}>Nenhum atendimento registrado hoje até o momento.</Text>
            </View>
          )}
        </View>

        <View style={styles.footerRow}>
          {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
          <Text style={styles.footNote}>Atualização em tempo real; consulta de segurança a cada 15 segundos.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
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
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 18 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 5, ...shadow.card, minWidth: 150,
  },
  kpiSkeleton: { height: 130, borderRadius: radius.lg, backgroundColor: colors.slate200, minWidth: 150 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 10.5, lineHeight: 14 },
  kpiSub: { fontFamily: font.body, fontWeight: '600', fontSize: 9.5 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    padding: 12, borderRadius: radius.md,
    backgroundColor: colors.red100, borderWidth: 1, borderColor: colors.red700,
  },
  alertBannerText: { flex: 1, color: colors.red700, fontFamily: font.body, fontWeight: '600', fontSize: 11.5, lineHeight: 17 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 10 },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: colors.slate100,
  },
  copyBtnText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  refreshBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.coral050, alignItems: 'center', justifyContent: 'center',
  },
  boothList: { gap: 12 },
  boothCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  boothHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  boothName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  cardMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, flexShrink: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: font.body, fontWeight: '700', fontSize: 9.5 },
  emptyBooth: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic', paddingVertical: 4 },
  brokerList: { gap: 8 },
  brokerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 10,
  },
  invalidatedItem: { backgroundColor: colors.amber100, borderColor: colors.amber100 },
  posBadge: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center',
  },
  posBadgeWarn: { backgroundColor: colors.amber700 },
  posText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 11.5 },
  brokerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brokerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13 },
  stageBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 5 },
  stageBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.3 },
  brokerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3, flexWrap: 'wrap' },
  brokerMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, flexShrink: 1 },
  entryBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 5 },
  entryBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: semantic.card, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm },
  timeText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  invalidatedBlock: { borderTopWidth: 1, borderTopColor: semantic.divider, paddingTop: 12, gap: 8 },
  invalidatedTitle: { color: colors.amber700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  footerRow: { alignItems: 'center', gap: 8, marginTop: 2 },
  footNote: { color: semantic.textFaint, fontFamily: font.body, fontSize: 10, textAlign: 'center' },
  attSection: { gap: 12 },
  attGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  attCard: {
    flex: 1, minWidth: 200,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 12, gap: 8,
  },
  attBooth: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 12.5 },
  attCells: { flexDirection: 'row', gap: 6 },
  attCell: {
    flex: 1, alignItems: 'center', gap: 1,
    borderRadius: radius.sm, paddingVertical: 6,
  },
  attVal: { fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  attLabel: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 8.5 },
  noAttBox: { borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md, padding: 14 },
  noAttText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic' },
  attErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.red300, backgroundColor: colors.red100,
    borderRadius: radius.md, padding: 12,
  },
  attErrorText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5, flexShrink: 1 },
  attErrorRetry: { borderWidth: 1, borderColor: colors.red700, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  attErrorRetryText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
});