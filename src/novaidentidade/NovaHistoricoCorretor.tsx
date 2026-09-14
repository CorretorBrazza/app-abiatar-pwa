// Histórico do Corretor — nova identidade.
// Diretoria e RH consultam qualquer corretor (seletor); Corretor e Recepção apenas o próprio.
// Filtros: Hoje | Esta semana (Segunda a Domingo) | Este mês | Período específico (máx 3 meses).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BadgeCheck,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Clock3,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateEmpty, StateError, StateOffline, StaleBanner } from './components/States';

type PeriodKey = 'today' | 'week' | 'month' | 'custom';

const STATUS_META: Record<string, { label: string; tone: keyof typeof statusTone }> = {
  completed: { label: 'Concluído', tone: 'positive' },
  invalidated: { label: 'Desconsiderado', tone: 'danger' },
  online: { label: 'Em andamento', tone: 'action' },
  paused: { label: 'Pausado', tone: 'attention' },
  absent: { label: 'Ausente', tone: 'danger' },
  attended: { label: 'Atendimento', tone: 'action' },
};

const ATT_TIPO_META: Record<string, { label: string; tone: keyof typeof statusTone }> = {
  vez: { label: 'Vez', tone: 'info' },
  agendamento: { label: 'Agendamento', tone: 'positive' },
  retorno: { label: 'Retorno', tone: 'attention' },
  simples: { label: 'Simples', tone: 'neutral' },
};

const PERIOD_PRESETS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mês' },
  { key: 'custom', label: 'Período' },
];

type StageKey = 'corretor_creci' | 'estagiario' | 'treinamento';

const STAGE_ORDER: StageKey[] = ['corretor_creci', 'estagiario', 'treinamento'];

const STAGE_LABEL: Record<StageKey, string> = {
  corretor_creci: 'Corretores CRECI',
  estagiario: 'Estagiários',
  treinamento: 'Em treinamento',
};

const STAGE_BADGE: Record<StageKey, string> = {
  corretor_creci: 'CRECI',
  estagiario: 'Estágio',
  treinamento: 'Treinamento',
};

function dateInTz(d: Date, tz = 'America/Sao_Paulo'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts;
}

function computeRange(key: PeriodKey, customStart: string, customEnd: string): { start: string; end: string } {
  const today = new Date();
  if (key === 'today') {
    const s = dateInTz(today);
    return { start: s, end: s };
  }
  if (key === 'week') {
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: dateInTz(monday), end: dateInTz(sunday) };
  }
  if (key === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: dateInTz(first), end: dateInTz(last) };
  }
  return { start: customStart, end: customEnd };
}

function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const NAVY_AVATAR_PALETTE = ['#2F4A60', '#1E3A54', '#98B0C2', '#41617C', '#12293E'];

export function HistoricoContent({
  brokerId,
  isMobile,
}: {
  brokerId: string;
  isMobile?: boolean;
}) {
  const [data, setData] = useState<any | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [customStart, setCustomStart] = useState(() => {
    const range = computeRange('month', '', '');
    return range.start;
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const range = computeRange('month', '', '');
    return range.end;
  });
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const range = computeRange(period, customStart, customEnd);
    const start = range.start;
    const end = range.end;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/presences/history/${brokerId}`, {
        params: { startDate: start, endDate: end },
      });
      setData(res.data);
      setOnline(true);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(true);
        setOnline(true);
      } else {
        setOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, [brokerId, period, customStart, customEnd]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const applyPeriod = (key: PeriodKey) => {
    setPeriod(key);
  };

  const range = useMemo(() => computeRange(period, customStart, customEnd), [period, customStart, customEnd]);
  const rangeValid =
    /^\d{4}-\d{2}-\d{2}$/.test(range.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.end) &&
    range.start <= range.end;

  if (loading && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={150} />
        <SkeletonBlock lines={2} height={260} />
      </ScrollView>
    );
  }

  if (error && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError
          message="Não foi possível carregar o histórico. Confira o período informado (máximo 3 meses)."
          onRetry={() => setRefreshKey((k) => k + 1)}
        />
      </ScrollView>
    );
  }

  const broker = data?.broker;
  const summary = data?.summary;
  const days: any[] = Array.isArray(data?.days) ? data.days : [];
  const attendances: any[] = Array.isArray(data?.attendances) ? data.attendances : [];
  const attendanceSummary = data?.attendanceSummary;

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}

      {/* Filtro de período */}
      <View style={styles.filterRow}>
        {PERIOD_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.presetBtn, period === p.key && styles.presetBtnActive]}
            onPress={() => applyPeriod(p.key)}
          >
            <Text style={[styles.presetText, period === p.key && styles.presetTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {period === 'custom' && (
        <View style={styles.customRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>Início (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={customStart}
              onChangeText={setCustomStart}
              placeholder="2026-01-01"
              placeholderTextColor={colors.slate400}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>Fim (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={customEnd}
              onChangeText={setCustomEnd}
              placeholder="2026-03-31"
              placeholderTextColor={colors.slate400}
            />
          </View>
        </View>
      )}

      <View style={styles.periodBadge}>
        <CalendarRange size={11} color={colors.slate600} />
        <Text style={styles.periodText}>
          Período: {formatDateShort(range.start)} a {formatDateShort(range.end)}
        </Text>
      </View>

      {/* Cartão do corretor */}
      {broker && (
        <View style={styles.brokerCard}>
          <View style={[styles.avatar, { backgroundColor: NAVY_AVATAR_PALETTE[broker.id.length % NAVY_AVATAR_PALETTE.length] }]}>
            <Text style={styles.avatarText}>{(broker.nomeGuerra || '?').charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={styles.brokerName}>
              {broker.nomeGuerra} <Text style={styles.brokerRealName}>({broker.name})</Text>
            </Text>
            <Text style={styles.brokerMeta}>
              CRECI: {broker.creci || '—'} · Estágio:{' '}
              {broker.brokerStage === 'corretor_creci' ? 'Corretor CRECI' : broker.brokerStage === 'estagiario' ? 'Estagiário' : 'Treinamento'} ·{' '}
              Ger.: {broker.managerName || 'Sem gerente'}
            </Text>
            <Text style={styles.brokerMeta}>
              Fim da carência: {formatDateShort(broker.carenciaEndsAt)} · Estágio vence: {formatDateShort(broker.stageExpiresAt)}
            </Text>
          </View>
        </View>
      )}

      {/* KPIs */}
      {summary && (
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.blue100 }]}>
              <UserCheck size={15} color={colors.blue700} />
            </View>
            <Text style={fonts.metricValueMobile}>{summary.totalCheckIns}</Text>
            <Text style={styles.kpiLabel}>Check-ins</Text>
          </View>
          <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.green100 }]}>
              <Clock3 size={15} color={colors.green700} />
            </View>
            <Text style={fonts.metricValueMobile}>{summary.totalHoursFormatted}</Text>
            <Text style={styles.kpiLabel}>Horas válidas</Text>
          </View>
          <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.coral050 }]}>
              <BadgeCheck size={15} color={colors.coral600} />
            </View>
            <Text style={fonts.metricValueMobile}>{summary.punctualityRate}%</Text>
            <Text style={styles.kpiLabel}>Pontualidade</Text>
          </View>
          <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
            <View style={[styles.kpiIcon, { backgroundColor: colors.amber100 }]}>
              <ShieldCheck size={15} color={colors.amber700} />
            </View>
            <Text style={fonts.metricValueMobile}>{summary.validationRate}%</Text>
            <Text style={styles.kpiLabel}>Aproveitamento</Text>
          </View>
        </View>
      )}

      {/* Atendimentos registrados (vez / agendamento / retorno) */}
      {attendanceSummary && (
        <View>
          <Text style={styles.sectionTitle}>Atendimentos registrados</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.blue100 }]}>
                <UserCheck size={15} color={colors.blue700} />
              </View>
              <Text style={fonts.metricValueMobile}>{attendanceSummary.vezCount ?? 0}</Text>
              <Text style={styles.kpiLabel}>Vez</Text>
            </View>
            <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.green100 }]}>
                <Clock3 size={15} color={colors.green700} />
              </View>
              <Text style={fonts.metricValueMobile}>{attendanceSummary.agendamentoCount ?? 0}</Text>
              <Text style={styles.kpiLabel}>Agendamento</Text>
            </View>
            <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.amber100 }]}>
                <ShieldCheck size={15} color={colors.amber700} />
              </View>
              <Text style={fonts.metricValueMobile}>{attendanceSummary.retornoCount ?? 0}</Text>
              <Text style={styles.kpiLabel}>Retorno</Text>
            </View>
            <View style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
              <View style={[styles.kpiIcon, { backgroundColor: colors.navy800 }]}>
                <BadgeCheck size={15} color="#fff" />
              </View>
              <Text style={fonts.metricValueMobile}>{attendanceSummary.total ?? 0}</Text>
              <Text style={styles.kpiLabel}>Total</Text>
            </View>
          </View>

          {attendances.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>Nenhum atendimento registrado no período selecionado.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {attendances.map((a: any) => {
                const meta = ATT_TIPO_META[a.tipo] || { label: a.tipo, tone: 'neutral' as const };
                const t = statusTone[meta.tone];
                return (
                  <View key={a.id} style={styles.attRow}>
                    <View style={[styles.attBadge, { backgroundColor: t.bg }]}>
                      <Text style={[styles.attBadgeText, { color: t.fg }]}>{meta.label}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text style={styles.entryName}>{a.boothName || 'Plantão'}</Text>
                      <Text style={styles.entryMeta}>
                        {formatDateShort(a.attendedAt)} · {formatTime(a.attendedAt)}
                        {a.inSequence ? ` · #${a.inSequence}` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Linha do tempo */}
      <Text style={styles.sectionTitle}>Linha do tempo de presenças</Text>

      {!rangeValid ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Informe um período válido (início menor ou igual ao fim).</Text>
        </View>
      ) : days.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>Nenhuma presença registrada no período selecionado.</Text>
        </View>
      ) : (
        days.map((day) => {
          const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
          const dayTotal = day.entries.length;
          const dayCompleted = day.entries.filter((e: any) => e.status === 'completed').length;
          return (
            <View key={day.date} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>
                    {formatDateShort(`${day.date}T12:00:00`)}
                  </Text>
                  <Text style={styles.dayWeekday}>{weekday} · {dayTotal} registro(s)</Text>
                </View>
                {dayCompleted > 0 && (
                  <Text style={[styles.dayOk, { color: colors.green700 }]}>{dayCompleted} concluído(s)</Text>
                )}
              </View>
              <View style={styles.dayList}>
                {day.entries.map((entry: any) => {
                  const meta = STATUS_META[entry.status] || { label: entry.status, tone: 'neutral' as const };
                  const t = statusTone[meta.tone];
                  return (
                    <View key={entry.id} style={styles.entryRow}>
                      <View style={[styles.roletaBadge, { backgroundColor: colors.navy800 }]}>
                        <Text style={styles.roletaNum}>#{entry.roletaPosition ?? '-'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <Text style={styles.entryName}>{entry.boothName || 'Plantão'}</Text>
                        <Text style={styles.entryMeta}>
                          {formatTime(entry.checkInAt)} → {formatTime(entry.checkOutAt || entry.lastConfirmedAt)} · {entry.roletaName} ·{' '}
                          {entry.roletaEntryType === 'pos_barra' ? 'Pós-barra' : 'Pontual'} · {entry.hoursFormatted}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: t.bg }]}>
                        <Text style={[styles.statusText, { color: t.fg }]}>{meta.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}

      <View style={styles.footerRow}>
        {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
      </View>
    </View>
  );
}

export default function NovaHistoricoCorretor({
  brokerId,
  canSelect,
  isMobile,
  onClose,
}: {
  brokerId?: string | null;
  canSelect?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(brokerId || null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Record<StageKey, boolean>>({
    corretor_creci: false,
    estagiario: false,
    treinamento: false,
  });

  const allowSelect = canSelect && !brokerId;

  useEffect(() => {
    if (brokerId) setSelected(brokerId);
  }, [brokerId]);

  useEffect(() => {
    if (!allowSelect) return;
    let cancelled = false;
    setLoadingList(true);
    api
      .get('/users/active-brokers', { params: { pageSize: 500 } })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setCandidates(raw);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowSelect]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      (c.nome_guerra || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.creci || '').toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const groups = useMemo(
    () =>
      STAGE_ORDER.map((s) => ({
        stage: s,
        brokers: filtered.filter((c) => (c.broker_stage || 'corretor_creci') === s),
      })).filter((g) => g.brokers.length > 0),
    [filtered],
  );

  const searching = search.trim().length > 0;

  if (!selected && !allowSelect) {
    if (!user?.id) return null;
    return <HistoricoContent brokerId={user.id} isMobile={isMobile} />;
  }

  if (!selected) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Users size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Histórico do corretor</Text>
          </View>
          <Text style={styles.heroTitle}>Escolha um corretor para consultar o histórico.</Text>
          <Text style={styles.heroSubtitle}>Roletas, check-ins, horas e aproveitamento por período.</Text>
        </View>

        <View style={styles.searchBox}>
          <Search size={13} color={colors.slate500} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome, nome de guerra ou CRECI..."
            placeholderTextColor={colors.slate400}
          />
        </View>

        {loadingList ? (
          <SkeletonBlock lines={2} height={140} />
        ) : filtered.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhum corretor encontrado.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {groups.map((g) => {
              const open = searching || !!expandedStages[g.stage];
              const tone = g.stage === 'corretor_creci' ? 'positive' : g.stage === 'treinamento' ? 'info' : 'attention';
              const t = statusTone[tone];
              return (
                <View key={g.stage}>
                  <TouchableOpacity
                    style={styles.groupHead}
                    onPress={() =>
                      setExpandedStages((prev) => ({
                        ...prev,
                        [g.stage]: !prev[g.stage],
                      }))
                    }
                  >
                    <View style={[styles.groupBullet, { backgroundColor: t.bg }]} />
                    <Text style={styles.groupTitle}>{STAGE_LABEL[g.stage]}</Text>
                    <Text style={styles.groupCount}>{g.brokers.length}</Text>
                    <View style={styles.chevronBox}>
                      {open ? <ChevronUp size={14} color={colors.slate500} /> : <ChevronDown size={14} color={colors.slate500} />}
                    </View>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.groupList}>
                      {g.brokers.map((c: any, idx: number) => (
                        <TouchableOpacity key={c.id} style={styles.brokerRow} onPress={() => setSelected(c.id)}>
                          <View style={[styles.avatar, { backgroundColor: NAVY_AVATAR_PALETTE[idx % NAVY_AVATAR_PALETTE.length] }]}>
                            <Text style={styles.avatarText}>{(c.nome_guerra || '?').charAt(0)}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                            <Text style={styles.rowName}>{c.nome_guerra}</Text>
                            <Text style={styles.rowMeta}>
                              CRECI: {c.creci || '—'} · {c.manager_nome_guerra ? `Ger.: ${c.manager_nome_guerra}` : 'Sem gerente'}
                            </Text>
                          </View>
                          <Text style={[styles.badgeText, { color: t.fg, backgroundColor: t.bg }]}>{STAGE_BADGE[g.stage]}</Text>
                          <Text style={styles.rowMeta}>Abrir ›</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  const backAction = onClose || (allowSelect ? () => setSelected(null) : null);

  return (
    <View style={{ flex: 1 }}>
      {backAction && (
        <View style={styles.selBar}>
          <TouchableOpacity onPress={backAction} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← {allowSelect && !onClose ? 'Escolher outro corretor' : dataLabel(selected, candidates)}</Text>
          </TouchableOpacity>
        </View>
      )}
      <HistoricoContent brokerId={selected} isMobile={isMobile} />
    </View>
  );
}

function dataLabel(id: string, list: any[]): string {
  if (id.startsWith('sel:')) return 'Seleção';
  const found = list.find((c) => c.id === id);
  return found?.nome_guerra || 'Histórico';
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 14, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 21, letterSpacing: -0.8, marginTop: 16 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.md,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border,
  },
  presetBtnActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  presetText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  presetTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', gap: 10 },
  dateLabel: {
    color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 10.5, marginBottom: 5,
  },
  dateInput: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 10, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  periodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.slate100,
  },
  periodText: { color: colors.slate600, fontFamily: font.body, fontWeight: '600', fontSize: 10.5 },
  brokerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, ...shadow.card,
  },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  brokerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 14 },
  brokerRealName: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '500', fontSize: 11.5 },
  brokerMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, lineHeight: 15 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, gap: 4, ...shadow.card, minWidth: 130,
  },
  kpiIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  sectionTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14.5, marginTop: 2 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, ...shadow.card,
  },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  dayCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, gap: 10, ...shadow.card,
  },
  dayHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  dayTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 13.5 },
  dayWeekday: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 2 },
  dayOk: { fontFamily: font.body, fontWeight: '700', fontSize: 10.5, paddingTop: 2 },
  dayList: { gap: 8 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.slate050, borderRadius: radius.md, padding: 10,
  },
  roletaBadge: { width: 36, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  roletaNum: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 10.5 },
  attRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.slate050, borderRadius: radius.md, padding: 10,
  },
  attBadge: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.full },
  attBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9, letterSpacing: 0.2 },
  entryName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  entryMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10, lineHeight: 15 },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  statusText: { fontFamily: font.body, fontWeight: '800', fontSize: 8.5 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: semantic.card, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border,
    paddingVertical: 10, paddingHorizontal: 12, ...shadow.card,
  },
  groupBullet: { width: 10, height: 10, borderRadius: 4 },
  groupTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14, flex: 1 },
  groupCount: { color: colors.slate500, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  chevronBox: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  groupList: { gap: 8, marginTop: 8 },
  badgeText: {
    fontFamily: font.body, fontWeight: '800', fontSize: 9.5, letterSpacing: 0.3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden',
  },
  brokerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 12, ...shadow.card,
  },
  rowName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13 },
  rowMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  footerRow: { alignItems: 'center' },
  selBar: { paddingHorizontal: 24, paddingTop: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.slate100 },
  backBtnText: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
});