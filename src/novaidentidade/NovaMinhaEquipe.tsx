import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateEmpty, StateError, StateOffline, StaleBanner } from './components/States';
import { ConvidarCorretoresCard } from './NovaConvidarCorretores';

function stageTone(stage?: string): keyof typeof statusTone {
  if (stage === 'treinamento') return 'info';
  if (stage === 'estagiario') return 'attention';
  return 'positive';
}

const stageLabel: Record<string, string> = {
  treinamento: 'Treinamento',
  estagiario: 'Estagiário',
  corretor_creci: 'Corretor CRECI',
};

const copyName = async (nomeGuerra: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(nomeGuerra);
      alert(`Nome "${nomeGuerra}" copiado com sucesso!`);
    } else {
      alert(`Corretor: ${nomeGuerra}`);
    }
  } catch {
    alert(`Corretor: ${nomeGuerra}`);
  }
};

export default function NovaMinhaEquipe({
  isMobile,
  managerId,
}: {
  isMobile?: boolean;
  managerId?: string;
}) {
  const { user, tenant } = useAuth();
  const [team, setTeam] = useState<any[]>([]);
  const [leadsQueue, setLeadsQueue] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const id = managerId || user?.id || '';

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [teamRes, queueRes, eligibilityRes] = await Promise.all([
        api.get(`/users/team/${id}`, { params: { pageSize: 200 } }),
        api.get('/users/leads-queue'),
        api.get('/presences/team-eligibility').catch(() => ({ data: null })),
      ]);
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : teamRes.data?.data || []);
      setLeadsQueue(queueRes.data?.queue || []);
      if (eligibilityRes.data) setEligibility(eligibilityRes.data);
      setOnline(true);
      setError(false);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('[MINHAEQUIPE] Falha ao atualizar equipe:', error);
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
  }, [id, refreshKey]);

  if (loading && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={140} />
        <SkeletonBlock lines={2} height={200} />
      </ScrollView>
    );
  }

  if (error && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError message="Não foi possível carregar sua equipe." onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />
      </ScrollView>
    );
  }

  const activeCount = team.filter((b) => b.status === 'active').length;
  const graceCount = team.filter((b) => b.status === 'grace_period').length;
  const suspendedCount = team.filter(
    (b) => b.is_suspended || b.is_stage_expired || b.is_inactive_90d,
  ).length;

  const kpis = [
    { label: 'Corretores ativos', value: activeCount, tone: 'positive' as const, icon: Users },
    { label: 'Em carência', value: graceCount, tone: 'attention' as const, icon: ShieldCheck },
    { label: 'Eleg. sábado', value: eligibility?.saturdayEligibleCount ?? 0, tone: 'info' as const, icon: CheckCircle2 },
    { label: 'Eleg. domingo', value: eligibility?.sundayEligibleCount ?? 0, tone: 'action' as const, icon: CheckCircle2 },
    { label: 'Na fila da roleta', value: leadsQueue.length, tone: eligibility?.fullyEligibleCount ? 'positive' as const : 'neutral' as const, icon: Target },
  ];

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Users size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>Gerência · Workspace tático</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{user?.nome_guerra ? `${user.nome_guerra},` : ''} sua equipe hoje.</Text>
          <Text style={styles.heroSubtitle}>{tenant?.name || 'ABIATAR'} · Acompanhe a fila, a elegibilidade e o time de campo.</Text>
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

        <View style={styles.sectionHead}>
          <View>
            <Text style={fonts.panelTitle}>Fila da roleta e leads da equipe ({leadsQueue.length})</Text>
            <Text style={styles.sectionSub}>Presenças da sua equipe no momento, com posição e validação.</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => loadData(true)} accessibilityLabel="Atualizar agora">
            <RefreshCw size={14} color={colors.coral600} />
          </TouchableOpacity>
        </View>

        {leadsQueue.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhum corretor da sua equipe na fila da roleta no momento.</Text>
          </View>
        ) : (
          <View style={styles.queueList}>
            {leadsQueue.map((item) => {
              const habilitado = String(item.isHabilitado || '').includes('HABILITADO');
              return (
                <View key={item.brokerId} style={[styles.queueCard, habilitado && styles.queueCardOk]}>
                  <View style={styles.queuePosBox}>
                    <Text style={styles.queuePosText}>
                      {item.roletaPosition ? `${item.roletaPosition}º` : '—'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={styles.queueNameRow}>
                      <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                      {item.roletaEntryType === 'pos_barra' && (
                        <View style={[styles.entryBadge, { backgroundColor: colors.amber700 }]}>
                          <Text style={styles.entryBadgeText}>PÓS-BARRA</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.queueMeta}>Presença: {item.statusPresenca} · Carência: {item.statusCarencia}</Text>
                    {item.minutesActive !== undefined && (
                      <Text style={[styles.queueMeta, { fontWeight: '700', color: (item.minutesActive ?? 0) >= (item.minimumRequiredMinutes ?? 120) ? colors.green700 : colors.amber700 }]}>
                        Validação roleta: {item.minutesActive} / {item.minimumRequiredMinutes ?? 120} min
                      </Text>
                    )}
                  </View>
                  <View style={styles.queueActions}>
                    <View style={[styles.habBadge, { backgroundColor: statusTone[habilitado ? 'positive' : 'danger'].bg }]}>
                      <Text style={[styles.habBadgeText, { color: statusTone[habilitado ? 'positive' : 'danger'].fg }]}>
                        {habilitado ? 'Habilitado' : 'Não habilitado'}
                      </Text>
                    </View>
                    {habilitado && (
                      <TouchableOpacity style={styles.copyBtn} onPress={() => void copyName(item.nomeGuerra)}>
                        <Copy size={13} color={colors.slate600} />
                        <Text style={styles.copyBtnText}>Copiar nome</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHead}>
          <View>
            <Text style={fonts.panelTitle}>Minha equipe ({team.length})</Text>
            <Text style={styles.sectionSub}>Corretores vinculados à sua gerência.</Text>
          </View>
        </View>

        {team.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhum corretor vinculado à sua equipe ainda.</Text>
          </View>
        ) : (
          <View style={styles.teamList}>
            {team.map((broker) => {
              const suspended = broker.is_suspended || broker.is_stage_expired || broker.is_inactive_90d;
              const st = statusTone[suspended ? 'danger' : stageTone(broker.broker_stage)];
              const grace = broker.status === 'grace_period';
              return (
                <View key={broker.id} style={styles.teamCard}>
                  <View style={styles.teamAvatar}>
                    <Text style={styles.teamAvatarText}>{(broker.nome_guerra || broker.name || '?').charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={styles.teamNameRow}>
                      <Text style={styles.teamName}>{broker.nome_guerra}</Text>
                      <View style={[styles.stageBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.stageBadgeText, { color: st.fg }]}>
                          {suspended ? `Suspenso (${broker.suspension_reason || 'Vencido'})` : stageLabel[broker.broker_stage] || 'Corretor'}
                        </Text>
                      </View>
                      {grace && (
                        <View style={[styles.stageBadge, { backgroundColor: colors.amber100 }]}>
                          <Text style={[styles.stageBadgeText, { color: colors.amber700 }]}>Carência</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.teamMeta}>CRECI: {broker.creci || '—'} · {broker.email}</Text>
                    {broker.days_until_stage_expiry !== null && broker.days_until_stage_expiry !== undefined && (
                      <Text style={styles.teamMeta}>Vigência do estágio: {broker.days_until_stage_expiry} dia(s) restante(s)</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <ConvidarCorretoresCard managerId={id} />

        <View style={styles.footerRow}>
          {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
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
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, gap: 10 },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  refreshBtn: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.coral050, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  queueList: { gap: 10 },
  queueCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 12,
  },
  queueCardOk: { borderColor: colors.green700, backgroundColor: colors.green100 },
  queuePosBox: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border,
    alignItems: 'center', justifyContent: 'center',
  },
  queuePosText: { color: colors.slate700, fontFamily: font.display, fontWeight: '800', fontSize: 11 },
  queueNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  queueName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13 },
  entryBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 5 },
  entryBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  queueMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  queueActions: { alignItems: 'flex-end', gap: 6 },
  habBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  habBadgeText: { fontFamily: font.body, fontWeight: '700', fontSize: 9 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border,
  },
  copyBtnText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  teamList: { gap: 10 },
  teamCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 13, ...shadow.card,
  },
  teamAvatar: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center',
  },
  teamAvatarText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  teamName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13.5 },
  stageBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 5 },
  stageBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9, letterSpacing: 0.3 },
  teamMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  footerRow: { alignItems: 'center' },
});