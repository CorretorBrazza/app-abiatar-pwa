import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarRange,
  ChevronRight,
  Clock3,
  Copy,
  ListChecks,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateError, StaleBanner } from './components/States';

type PeriodKey = 'today' | 'week' | 'month' | 'lastMonth' | 'quarter';

const PERIOD_PRESETS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: 'quarter', label: '3 meses' },
];

const STATUS_META: Record<string, { label: string; tone: keyof typeof statusTone }> = {
  completed: { label: 'Concluído', tone: 'positive' },
  invalidated: { label: 'Desconsiderado', tone: 'danger' },
  online: { label: 'Em andamento', tone: 'action' },
  paused: { label: 'Pausado', tone: 'attention' },
  absent: { label: 'Ausente', tone: 'danger' },
};

function dateInTz(d: Date, tz = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function computeRange(key: PeriodKey): { start: string; end: string } {
  const today = new Date();
  if (key === 'today') {
    const s = dateInTz(today);
    return { start: s, end: s };
  }
  if (key === 'week') {
    const diffToMonday = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: dateInTz(monday), end: dateInTz(sunday) };
  }
  if (key === 'month') {
    return {
      start: dateInTz(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: dateInTz(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (key === 'lastMonth') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: dateInTz(first), end: dateInTz(last) };
  }
  const start = new Date(today);
  start.setDate(today.getDate() - 90);
  return { start: dateInTz(start), end: dateInTz(today) };
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function spTime(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NovaRelatorioRecepcao({ isMobile }: { isMobile?: boolean }) {
  const { tenant } = useAuth();
  const [booths, setBooths] = useState<any[]>([]);
  const [boothFilter, setBoothFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copying, setCopying] = useState(false);
  const [openRoleta, setOpenRoleta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/booths/assigned')
      .then((res) => {
        if (!cancelled) setBooths(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const range = computeRange(period);
    setLoading(true);
    setError(false);
    setErrorMsg(null);
    try {
      const res = await api.get('/presences/reports/reception', {
        params: {
          startDate: range.start,
          endDate: range.end,
          ...(boothFilter !== 'all' ? { boothId: boothFilter } : {}),
        },
        timeout: 30000,
      });
      setData(res.data);
      setOnline(true);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      const status = err.response?.status;
      const serverMsg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join('. ')
        : err.response?.data?.message;
      if (status === 400) {
        setError(true);
        setOnline(true);
        setErrorMsg(serverMsg ? `${serverMsg}.` : 'Confira o período (máximo 3 meses).');
      } else if (err.code === 'ECONNABORTED') {
        setOnline(false);
        setErrorMsg('O servidor demorou para responder. Tente novamente em instantes.');
      } else {
        setOnline(false);
        setErrorMsg(status ? `Erro ${status} ao carregar o relatório.` : 'Falha de conexão ao carregar o relatório.');
      }
    } finally {
      setLoading(false);
    }
  }, [period, boothFilter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleCopySummary = async () => {
    if (!data) return;
    setCopying(true);
    try {
      const a = data.atendimentos;
      const perBooth: any[] = a?.perBooth || [];
      const totals = a?.totals || { vez: 0, agendamento: 0, retorno: 0, total: 0 };
      let text = `📋 *RELATÓRIO DA RECEPÇÃO* — ${tenant?.name || 'ABIATAR'}\n`;
      text += `📅 ${fmtDate(data.period?.startDate)} a ${fmtDate(data.period?.endDate)}\n\n`;
      text += `📍 *ATENDIMENTOS POR PLANTÃO:*\n`;
      if (perBooth.length === 0) text += `• Nenhum atendimento no período.\n`;
      perBooth.forEach((b) => {
        text += `• ${b.boothName}: Vez ${b.vez} · Agendamento ${b.agendamento} · Retorno ${b.retorno} (total ${b.total})\n`;
      });
      text += `\n*Totais:* Vez ${totals.vez} · Agendamento ${totals.agendamento} · Retorno ${totals.retorno} · Geral ${totals.total}\n`;
      if (Array.isArray(data.roletas) && data.roletas.length > 0) {
        text += `\n🎟 *ROLETAS NO PERÍODO:* ${data.roletas.length}\n`;
      }
      const elegiveis: any[] = data.elegiveis || [];
      const withElig = elegiveis.filter((e) => e.saturday.length > 0 || e.sunday.length > 0);
      if (withElig.length > 0) {
        text += `\n⭐ *ELEGÍVEIS PRÓXIMO FINAL DE SEMANA:*\n`;
        withElig.forEach((e) => {
          text += `• ${e.boothName}: Sábado ${e.saturday.length} · Domingo ${e.sunday.length}\n`;
        });
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('Relatório copiado para a área de transferência! Pronto para colar no WhatsApp.');
      } else {
        alert('Relatório gerado com sucesso.');
      }
    } finally {
      setCopying(false);
    }
  };

  if (loading && !data) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={130} />
        <SkeletonBlock lines={1} height={120} />
        <SkeletonBlock lines={2} height={200} />
      </ScrollView>
    );
  }

  if (error && !data) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError
          message={errorMsg || 'Não foi possível carregar o relatório. Confira o período (máximo 3 meses).'}
          onRetry={() => {
            setLoading(true);
            setRefreshKey((k) => k + 1);
          }}
        />
      </ScrollView>
    );
  }

  const atendimentos = data?.atendimentos || { perBooth: [], totals: { vez: 0, agendamento: 0, retorno: 0, total: 0 } };
  const roletas: any[] = data?.roletas || [];
  const elegiveis: any[] = data?.elegiveis || [];

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!online && (
          <StateError
            message={errorMsg || 'Falha de conexão ao carregar o relatório.'}
            onRetry={() => setRefreshKey((k) => k + 1)}
          />
        )}

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <CalendarRange size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Recepção · Relatório</Text>
          </View>
          <Text style={styles.heroTitle}>Roletas, atendimentos e elegíveis do fim de semana.</Text>
          <Text style={styles.heroSubtitle}>
            Consulte por plantão e período (máximo 3 meses) e copie o resumo para enviar à Diretoria.
          </Text>
        </View>

        <View style={styles.filters}>
          <View style={styles.presetRow}>
            {PERIOD_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.presetBtn, period === p.key && styles.presetBtnActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.presetText, period === p.key && styles.presetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boothRow}>
            <TouchableOpacity
              style={[styles.boothChip, boothFilter === 'all' && styles.boothChipActive]}
              onPress={() => setBoothFilter('all')}
            >
              <Text style={[styles.boothChipText, boothFilter === 'all' && styles.boothChipTextActive]}>Todos</Text>
            </TouchableOpacity>
            {booths.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.boothChip, boothFilter === b.id && styles.boothChipActive]}
                onPress={() => setBoothFilter(b.id)}
              >
                <Text style={[styles.boothChipText, boothFilter === b.id && styles.boothChipTextActive]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={fonts.panelTitle}>Atendimentos</Text>
              <Text style={styles.sectionSub}>
                {fmtDate(data?.period?.startDate)} a {fmtDate(data?.period?.endDate)} · por tipo
              </Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} disabled={copying} onPress={() => void handleCopySummary()}>
              {copying ? (
                <Clock3 size={13} color={colors.green700} />
              ) : (
                <Copy size={13} color={colors.green700} />
              )}
              <Text style={styles.copyBtnText}>{copying ? 'Copiando...' : 'Copiar resumo'}</Text>
            </TouchableOpacity>
          </View>

          {atendimentos.perBooth.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum atendimento registrado no período.</Text>
          ) : (
            <View style={styles.summaryGrid}>
              {atendimentos.perBooth.map((b: any) => (
                <View key={b.boothId} style={styles.summaryCard}>
                  <Text style={styles.summaryBooth} numberOfLines={1}>
                    {b.boothName}
                  </Text>
                  <View style={styles.summaryRow}>
                    <View style={[styles.summaryCell, { backgroundColor: statusTone.positive.bg }]}>
                      <Text style={[styles.summaryVal, { color: colors.green700 }]}>{b.vez}</Text>
                      <Text style={styles.summaryLabel}>Vez</Text>
                    </View>
                    <View style={[styles.summaryCell, { backgroundColor: statusTone.info.bg }]}>
                      <Text style={[styles.summaryVal, { color: colors.navy800 }]}>{b.agendamento}</Text>
                      <Text style={styles.summaryLabel}>Agend.</Text>
                    </View>
                    <View style={[styles.summaryCell, { backgroundColor: statusTone.attention.bg }]}>
                      <Text style={[styles.summaryVal, { color: colors.amber700 }]}>{b.retorno}</Text>
                      <Text style={styles.summaryLabel}>Retorno</Text>
                    </View>
                    <View style={styles.summaryCell}>
                      <Text style={styles.summaryValTotal}>{b.total}</Text>
                      <Text style={styles.summaryLabel}>Total</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.totalsRow}>
            <Text style={styles.totalsText}>
              Totais · Vez <Text style={{ color: colors.green700, fontFamily: font.body, fontWeight: '800' }}>{atendimentos.totals.vez}</Text>
              {'   '}Agend. <Text style={{ color: colors.navy800, fontFamily: font.body, fontWeight: '800' }}>{atendimentos.totals.agendamento}</Text>
              {'   '}Retorno <Text style={{ color: colors.amber700, fontFamily: font.body, fontWeight: '800' }}>{atendimentos.totals.retorno}</Text>
              {'   '}Geral <Text style={{ fontFamily: font.body, fontWeight: '800' }}>{atendimentos.totals.total}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={fonts.panelTitle}>Roletas anteriores</Text>
              <Text style={styles.sectionSub}>Sequência do sorteio por plantão no período.</Text>
            </View>
            <View style={styles.countBadge}>
              <ListChecks size={12} color={colors.slate600} />
              <Text style={styles.countBadgeText}>{roletas.length}</Text>
            </View>
          </View>

          {roletas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma roleta registrada no período.</Text>
          ) : (
            <View style={styles.roletaList}>
              {roletas.map((r, idx) => {
                const key = `${r.boothId}::${r.roletaName}`;
                const open = openRoleta === key;
                return (
                  <View key={`${key}::${idx}`} style={styles.roletaCard}>
                    <TouchableOpacity
                      style={styles.roletaHead}
                      onPress={() => setOpenRoleta(open ? null : key)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.roletaInfo}>
                        <Text style={styles.roletaName} numberOfLines={1}>
                          {r.roletaName}
                        </Text>
                        <Text style={styles.roletaMeta}>
                          {r.boothName} · {fmtDate(r.drawAt)} {spTime(r.drawAt)}
                        </Text>
                      </View>
                      <View style={styles.roletaSide}>
                        <Text style={styles.roletaCount}>{r.sequence.length} na roleta</Text>
                        <ChevronRight
                          size={15}
                          color={colors.slate500}
                          style={[styles.roletaArrow, open && styles.roletaArrowOpen]}
                        />
                      </View>
                    </TouchableOpacity>
                    {open && (
                      <View style={styles.sequence}>
                        {r.sequence.map((s: any) => {
                          const meta =
                            STATUS_META[s.status || ''] || { label: s.status || '—', tone: 'neutral' as const };
                          const t = statusTone[meta.tone];
                          return (
                            <View key={`${s.nomeGuerra}::${r.roletaName}`} style={styles.seqRow}>
                              <Text style={styles.seqPos}>
                                {s.position != null ? `${s.position}º` : '—'}
                              </Text>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.seqName} numberOfLines={1}>
                                  {s.nomeGuerra}
                                </Text>
                                <Text style={styles.seqMeta}>
                                  {s.entryType === 'pos_barra' ? 'pós-barra' : 'pontual'}
                                  {s.attendedAt ? ` · atendido ${fmtTime(s.attendedAt)}` : ''}
                                </Text>
                              </View>
                              <View style={[styles.seqBadge, { backgroundColor: t.bg }]}>
                                <Text style={[styles.seqBadgeText, { color: t.fg }]}>{meta.label}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={fonts.panelTitle}>Elegíveis para o próximo fim de semana</Text>
              <Text style={styles.sectionSub}>Quem atinge o mínimo de roletas para o próximo sábado e/ou domingo.</Text>
            </View>
          </View>

          {elegiveis.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum plantão publicado no período.</Text>
          ) : (
            <View style={styles.elegiveisList}>
              {elegiveis.map((e) => (
                <View key={e.boothId} style={styles.elegivelCard}>
                  <Text style={styles.roletaName} numberOfLines={1}>
                    {e.boothName}
                  </Text>
                  {!e.weekendEnabled ? (
                    <Text style={styles.emptyText}>Roleta de fim de semana desativada neste plantão.</Text>
                  ) : (
                    <View style={styles.elegivelRow}>
                      <View style={styles.elegivelCol}>
                        <View style={[styles.dayBadge, { backgroundColor: statusTone.positive.bg }]}>
                          <Text style={[styles.dayBadgeText, { color: colors.green700 }]}>
                            Sábado · precisa de {e.saturdayRequired} roletas
                          </Text>
                        </View>
                        {e.saturday.length === 0 ? (
                          <Text style={styles.seqMeta}>Ninguém elegível ainda.</Text>
                        ) : (
                          <View style={styles.dayList}>
                            {e.saturday.map((b: any) => (
                              <Text key={b.brokerId} style={styles.dayName}>
                                {b.nomeGuerra}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={styles.elegivelCol}>
                        <View style={[styles.dayBadge, { backgroundColor: statusTone.info.bg }]}>
                          <Text style={[styles.dayBadgeText, { color: colors.navy800 }]}>
                            Domingo · precisa de {e.sundayRequired} roletas
                          </Text>
                        </View>
                        {e.sunday.length === 0 ? (
                          <Text style={styles.seqMeta}>Ninguém elegível ainda.</Text>
                        ) : (
                          <View style={styles.dayList}>
                            {e.sunday.map((b: any) => (
                              <Text key={b.brokerId} style={styles.dayName}>
                                {b.nomeGuerra}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {elegiveis.length === 0 && (
            <View style={{ alignItems: 'center' }}>
              <Users size={18} color={colors.slate400} />
            </View>
          )}
        </View>

        <Text style={styles.footNote}>
          Relatório da recepção · período máximo 3 meses · atualizado {lastUpdated || '—'}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 9.5, letterSpacing: 1.4 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 20, letterSpacing: -0.6, marginTop: 16 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  filters: { gap: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.slate050,
  },
  presetBtnActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  presetText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  presetTextActive: { color: '#fff' },
  boothRow: { gap: 8 },
  boothChip: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.slate050,
  },
  boothChipActive: { backgroundColor: colors.coral050, borderColor: colors.coral600 },
  boothChipText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  boothChipTextActive: { color: colors.coral600 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.green700, borderRadius: radius.md,
    paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.green100,
  },
  copyBtnText: { color: colors.green700, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    flex: 1, minWidth: 220,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 12, gap: 8,
  },
  summaryBooth: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 12.5 },
  summaryRow: { flexDirection: 'row', gap: 6 },
  summaryCell: {
    flex: 1, alignItems: 'center', gap: 1,
    borderRadius: radius.sm, paddingVertical: 6,
  },
  summaryVal: { fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  summaryValTotal: { fontFamily: font.display, fontWeight: '800', fontSize: 15, color: semantic.textPrimary },
  summaryLabel: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 8.5 },
  totalsRow: { borderTopWidth: 1, borderTopColor: semantic.divider, paddingTop: 10 },
  totalsText: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 11 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.slate100,
  },
  countBadgeText: { color: colors.slate600, fontFamily: font.body, fontWeight: '800', fontSize: 11 },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic' },
  roletaList: { gap: 8 },
  roletaCard: { borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md, backgroundColor: colors.slate050, overflow: 'hidden' },
  roletaHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: 12,
  },
  roletaInfo: { flex: 1, minWidth: 0, gap: 3 },
  roletaName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 13.5 },
  roletaMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  roletaSide: { alignItems: 'flex-end', gap: 3 },
  roletaCount: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  roletaArrow: { transform: [{ rotate: '0deg' }] },
  roletaArrowOpen: { transform: [{ rotate: '90deg' }] },
  sequence: { borderTopWidth: 1, borderTopColor: semantic.divider, padding: 10, gap: 7 },
  seqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seqPos: { width: 26, textAlign: 'center', fontFamily: font.display, fontWeight: '800', fontSize: 11.5, color: colors.slate600 },
  seqName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  seqMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 9.5, marginTop: 1 },
  seqBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm },
  seqBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 8.5 },
  elegiveisList: { gap: 10 },
  elegivelCard: {
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    backgroundColor: colors.slate050, padding: 12, gap: 10,
  },
  elegivelRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  elegivelCol: { flex: 1, minWidth: 200, gap: 7 },
  dayBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-start' },
  dayBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9 },
  dayList: { gap: 2 },
  dayName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '600', fontSize: 11.5 },
  footNote: { color: semantic.textFaint, fontFamily: font.body, fontSize: 10, textAlign: 'center', marginTop: 4 },
});