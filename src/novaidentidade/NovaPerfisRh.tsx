import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BadgeCheck, ChevronDown, ChevronRight, ChevronUp, Clock3, Users } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { FichaCorretorModal } from './NovaGestaoCorretores';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateError, StateOffline, StaleBanner } from './components/States';

const NAVY_AVATAR_PALETTE = ['#2F4A60', '#1E3A54', '#98B0C2', '#41617C', '#12293E'];

type StageKey = 'corretor_creci' | 'estagiario' | 'treinamento';

const STAGE_ORDER: StageKey[] = ['corretor_creci', 'estagiario', 'treinamento'];

const STAGE_LABEL: Record<StageKey, string> = {
  corretor_creci: 'Corretores CRECI',
  estagiario: 'Estagiários',
  treinamento: 'Em treinamento',
};

const stageTone = (stage?: string): keyof typeof statusTone => {
  if (stage === 'treinamento') return 'info';
  if (stage === 'estagiario') return 'attention';
  return 'positive';
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function NovaPerfisRh({
  view,
  isMobile,
  sidebarOffset = 0,
  topOffset = 0,
}: {
  view: 'rh_careers' | 'rh_credentials';
  isMobile?: boolean;
  sidebarOffset?: number;
  topOffset?: number;
}) {
  const { user } = useAuth();
  const [brokers, setBrokers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fichaBrokerId, setFichaBrokerId] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Record<StageKey, boolean>>({
    corretor_creci: false,
    estagiario: false,
    treinamento: false,
  });

  const isCareers = view === 'rh_careers';

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [brokersRes, managersRes] = await Promise.all([
        api.get('/users/active-brokers', { params: { pageSize: 500 } }),
        api.get('/users/managers/active'),
      ]);
      const brokersData = Array.isArray(brokersRes.data) ? brokersRes.data : brokersRes.data?.data || [];
      setBrokers(brokersData);
      setManagers(Array.isArray(managersRes.data) ? managersRes.data : []);
      setOnline(true);
      setError(false);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('[PERFISRH] Falha ao carregar perfis:', err);
      setError(true);
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadData();
    const handleRealtime = () => { if (!cancelled) void loadData(true); };
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:realtime', handleRealtime);
      window.addEventListener('abiatar:push', handleRealtime);
    }
    const intervalId = setInterval(() => { if (!cancelled) void loadData(true); }, 30000);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:realtime', handleRealtime);
        window.removeEventListener('abiatar:push', handleRealtime);
      }
      clearInterval(intervalId);
    };
  }, [refreshKey]);

  if (loading && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={140} />
        <SkeletonBlock lines={2} height={220} />
      </ScrollView>
    );
  }

  if (error && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError message="Não foi possível carregar os perfis." onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />
      </ScrollView>
    );
  }

  const countByStage = (s: StageKey) => brokers.filter((b) => b.broker_stage === s).length;
  const active = brokers.filter((b) => b.status === 'active').length;
  const expired = brokers.filter((b) => b.is_stage_expired).length;
  const expiringSoon = brokers.filter(
    (b) => !b.is_stage_expired && b.days_until_stage_expiry != null && b.days_until_stage_expiry <= 15,
  ).length;

  const kpis =
    view === 'rh_credentials'
      ? [
          { label: 'Vigências de CRECI', value: countByStage('corretor_creci'), tone: 'positive' as const, icon: BadgeCheck },
          { label: 'Estágios ativos', value: countByStage('estagiario') + countByStage('treinamento'), tone: 'info' as const, icon: Clock3 },
          { label: 'Vigorando', value: active, tone: 'action' as const, icon: Users },
          { label: 'A vencer em 15 dias', value: expiringSoon, tone: 'attention' as const, icon: Clock3 },
          { label: 'Estágio vencido', value: expired, tone: 'danger' as const, icon: Clock3 },
        ]
      : [
          { label: 'Corretores CRECI', value: countByStage('corretor_creci'), tone: 'positive' as const, icon: BadgeCheck },
          { label: 'Estagiários', value: countByStage('estagiario'), tone: 'attention' as const, icon: Users },
          { label: 'Em treinamento', value: countByStage('treinamento'), tone: 'info' as const, icon: Users },
          { label: 'Ativos', value: active, tone: 'action' as const, icon: Users },
        ];

  const grouped = STAGE_ORDER.map((s) => ({
    stage: s,
    brokers: isCareers ? brokers.filter((b) => b.broker_stage === s) : [],
  })).filter((g) => g.brokers.length > 0);

  const credentialList = brokers
    .filter((b) => b.stage_expires_at || b.carencia_ends_at || b.is_stage_expired || b.days_until_stage_expiry != null)
    .sort((a, b) => (a.days_until_stage_expiry ?? 99999) - (b.days_until_stage_expiry ?? 99999));

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <BadgeCheck size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>RH · {isCareers ? 'Carreiras e estágios' : 'Vigências e CRECI'}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{isCareers ? 'Carreiras, estágios e evolução.' : 'Vigências e credenciais dos corretores.'}</Text>
          <Text style={styles.heroSubtitle}>
            {user?.nome_guerra ? user.nome_guerra : 'RH'} · visão consolidada dos perfis profissionais e suas vigências.
          </Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => {
            const t = statusTone[k.tone];
            const Icon = k.icon;
            return (
              <View key={k.label} style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: t.bg }]}>
                  <Icon size={15} color={t.fg} />
                </View>
                <Text style={fonts.metricValueMobile}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            );
          })}
        </View>

        {isCareers ? (
          grouped.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>Nenhum corretor ativo por estágio no momento.</Text>
            </View>
          ) : (
            grouped.map((g) => {
              const st = statusTone[stageTone(g.stage)];
              const open = !!expandedStages[g.stage];
              return (
                <View key={g.stage}>
                  <TouchableOpacity
                    style={styles.groupHead}
                    onPress={() => setExpandedStages((prev) => ({ ...prev, [g.stage]: !prev[g.stage] }))}
                  >
                    <View style={[styles.groupBullet, { backgroundColor: st.bg }]} />
                    <Text style={styles.groupTitle}>{STAGE_LABEL[g.stage]}</Text>
                    <Text style={styles.groupCount}>{g.brokers.length}</Text>
                    <View style={styles.chevronBox}>
                      {open ? <ChevronUp size={14} color={colors.slate500} /> : <ChevronDown size={14} color={colors.slate500} />}
                    </View>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.list}>
                      {g.brokers.map((broker, idx) => {
                        const suspended = broker.is_suspended || broker.is_stage_expired || broker.is_inactive_90d;
                        const tone = statusTone[suspended ? 'danger' : stageTone(g.stage)];
                        return (
                          <TouchableOpacity key={broker.id} style={styles.row} onPress={() => setFichaBrokerId(broker.id)}>
                            <View style={[styles.avatar, { backgroundColor: NAVY_AVATAR_PALETTE[idx % NAVY_AVATAR_PALETTE.length] }]}>
                              <Text style={styles.avatarText}>{(broker.nome_guerra || '?').charAt(0)}</Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Text style={styles.rowName}>{broker.nome_guerra}</Text>
                              <Text style={styles.rowMeta}>
                                CRECI: {broker.creci || '—'} · Carência: {broker.carencia_ends_at ? formatDate(broker.carencia_ends_at) : '—'}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Text style={[styles.badgeText, { color: tone.fg, backgroundColor: tone.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden' }]}>
                                {suspended
                                  ? 'Suspenso'
                                  : g.stage === 'corretor_creci'
                                    ? 'CRECI'
                                    : g.stage === 'treinamento'
                                      ? 'Treinamento'
                                      : 'Estágio'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )
        ) : (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ChevronRight size={14} color={colors.coral600} />
              <Text style={styles.cardTitle}>Vigências ordenadas por prazo</Text>
            </View>
            {credentialList.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma vigência registrada para exibir.</Text>
            ) : (
              credentialList.map((broker, idx) => {
                const tone = statusTone[broker.is_stage_expired ? 'danger' : (broker.days_until_stage_expiry ?? 99999) <= 15 ? 'attention' : 'positive'];
                return (
                  <TouchableOpacity key={broker.id} style={[styles.credRow, broker.is_stage_expired && styles.credRowExpired]} onPress={() => setFichaBrokerId(broker.id)}>
                    <View style={[styles.avatar, { backgroundColor: NAVY_AVATAR_PALETTE[idx % NAVY_AVATAR_PALETTE.length] }]}>
                      <Text style={styles.avatarText}>{(broker.nome_guerra || '?').charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text style={styles.rowName}>{broker.nome_guerra}</Text>
                      <Text style={styles.rowMeta}>
                        CRECI: {broker.creci || '—'} · Estágio: {STAGE_LABEL[broker.broker_stage as StageKey] || broker.broker_stage || '—'} · {broker.manager_nome_guerra ? `Ger.: ${broker.manager_nome_guerra}` : ''}
                      </Text>
                      <View style={styles.credDates}>
                        <Text style={styles.dateChip}>Carência: {formatDate(broker.carencia_ends_at)}</Text>
                        <Text style={styles.dateChip}>Vigência estágio: {formatDate(broker.stage_expires_at)}</Text>
                      </View>
                    </View>
                    <View style={[styles.progressWrap, { width: isMobile ? 92 : 130 }]}>
                      <View style={[styles.progressBar, { backgroundColor: tone.bg, width: `${Math.max(6, Math.min(100, ((broker.days_until_stage_expiry ?? 0) / 90) * 100))}%` as any }]} />
                      <Text style={[styles.progressText, { color: tone.fg }]}>
                        {broker.is_stage_expired ? 'VENCIDO' : `${broker.days_until_stage_expiry ?? '—'} dia(s)`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={styles.footerRow}>
          {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
        </View>
      </ScrollView>

      <FichaCorretorModal
        brokerId={fichaBrokerId}
        managers={managers}
        isMobile={isMobile}
        sidebarOffset={sidebarOffset}
        topOffset={topOffset}
        mode="rh"
        onClose={() => setFichaBrokerId(null)}
        onSaved={() => void loadData()}
      />
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
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 18 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 5, ...shadow.card, minWidth: 130,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 10.5, lineHeight: 14 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  cardTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
    backgroundColor: semantic.card, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border,
    paddingVertical: 10, paddingHorizontal: 12, ...shadow.card,
  },
  groupBullet: { width: 10, height: 10, borderRadius: 4 },
  groupTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14, flex: 1 },
  groupCount: { color: colors.slate500, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  chevronBox: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 12, ...shadow.card,
  },
  avatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  rowName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13.5 },
  rowMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  badge: { alignItems: 'flex-end' },
  badgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5, letterSpacing: 0.3 },
  credRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap',
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 12, marginBottom: 8,
  },
  credRowExpired: { borderColor: colors.red700, backgroundColor: colors.red100 },
  credDates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border,
    borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2,
    color: semantic.textMuted, fontFamily: font.body, fontSize: 9.5,
  },
  progressWrap: { gap: 5, alignSelf: 'stretch', justifyContent: 'center' },
  progressBar: { height: 6, borderRadius: radius.full, backgroundColor: colors.slate200 },
  progressText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5, textAlign: 'right' },
  footerRow: { alignItems: 'center' },
});