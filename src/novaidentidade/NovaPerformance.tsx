import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Building2,
  Clock,
  Copy,
  RefreshCw,
  Radio,
  Search,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';

type TabType = 'realtime' | 'brokers' | 'managers' | 'booths';
type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getStartOfWeekString(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function getStartOfMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDateDisplay(isoDate?: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatStageBadge(stage?: string) {
  if (stage === 'corretor_creci') return { label: 'CRECI', bg: '#dcfce7', text: '#15803d' };
  if (stage === 'estagiario') return { label: 'Estagiário', bg: '#fef3c7', text: '#b45309' };
  if (stage === 'treinamento') return { label: 'Treinamento', bg: '#e0e7ff', text: '#4338ca' };
  return { label: 'Corretor', bg: colors.coral050, text: colors.coral600 };
}

function computeWeekendShortfall(broker: any): number {
  if (broker.weekendEligible) return 0;
  if (Array.isArray(broker.boothsStatus) && broker.boothsStatus.length > 0) {
    let shortfall = Number.POSITIVE_INFINITY;
    for (const booth of broker.boothsStatus) {
      if (booth.saturdayEligible || booth.sundayEligible) return 0;
      const keep = booth.validRoletasThisWeek ?? 0;
      const satReq = booth.saturdayRequired ?? 5;
      const sunReq = booth.sundayRequired ?? 6;
      shortfall = Math.min(shortfall, Math.max(0, satReq - keep), Math.max(0, sunReq - keep));
    }
    return shortfall === Number.POSITIVE_INFINITY ? 0 : shortfall;
  }
  return Math.max(0, 5 - (broker.currentWeekValidRoletas || 0));
}

const TABS: { key: TabType; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'realtime', label: 'Tempo Real', icon: Radio },
  { key: 'brokers', label: 'Corretores', icon: Users },
  { key: 'managers', label: 'Equipes', icon: UsersRound },
  { key: 'booths', label: 'Plantões', icon: Building2 },
];

export default function NovaPerformance({ isMobile }: { isMobile?: boolean }) {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('realtime');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchBroker, setSearchBroker] = useState('');
  const [selectedBoothFilter, setSelectedBoothFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [brokersReport, setBrokersReport] = useState<any>(null);
  const [managersReport, setManagersReport] = useState<any>(null);
  const [boothsReport, setBoothsReport] = useState<any>(null);
  const [boothsList, setBoothsList] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const applyPeriodPreset = useCallback(
    (preset: PeriodPreset) => {
      const today = getTodayString();
      if (preset === 'today') {
        setStartDate(today);
        setEndDate(today);
      } else if (preset === 'week') {
        setStartDate(getStartOfWeekString());
        setEndDate(today);
      } else if (preset === 'month') {
        setStartDate(getStartOfMonthString());
        setEndDate(today);
      }
      if (preset !== 'custom' && activeTab !== 'realtime') {
        return;
      }
    },
    [activeTab],
  );

  useEffect(() => {
    const today = getTodayString();
    if (periodPreset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (periodPreset === 'week') {
      setStartDate(getStartOfWeekString());
      setEndDate(today);
    } else if (periodPreset === 'month') {
      setStartDate(getStartOfMonthString());
      setEndDate(today);
    }
  }, [periodPreset]);

  const loadData = useCallback(
    async (startOverride?: string, endOverride?: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const effectiveStart = startOverride !== undefined ? startOverride : startDate;
        const effectiveEnd = endOverride !== undefined ? endOverride : endDate;
        if (activeTab === 'realtime') {
          const res = await api.get('/presences/reports/realtime');
          setRealtimeData(res.data);
        } else if (activeTab === 'brokers') {
          const res = await api.get('/presences/reports/brokers', {
            params: {
              startDate: effectiveStart || undefined,
              endDate: effectiveEnd || undefined,
              boothId: selectedBoothFilter || undefined,
            },
          });
          setBrokersReport(res.data);
        } else if (activeTab === 'managers') {
          const res = await api.get('/presences/reports/managers', {
            params: {
              startDate: effectiveStart || undefined,
              endDate: effectiveEnd || undefined,
            },
          });
          setManagersReport(res.data);
        } else if (activeTab === 'booths') {
          const res = await api.get('/presences/reports/booths', {
            params: {
              startDate: effectiveStart || undefined,
              endDate: effectiveEnd || undefined,
            },
          });
          setBoothsReport(res.data);
        }
        setLastSync(new Date());
      } catch (error: any) {
        console.error('Erro ao carregar relatório executivo:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, startDate, endDate, selectedBoothFilter],
  );

  useEffect(() => {
    void api
      .get('/booths')
      .then((res) => setBoothsList(Array.isArray(res.data) ? res.data : []))
      .catch((e) => console.warn('Erro ao carregar lista de plantões:', e));
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== 'realtime') return;
    const handleRealtime = () => void loadData(undefined, undefined, { silent: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:realtime', handleRealtime);
      window.addEventListener('abiatar:booth_update', handleRealtime);
    }
    const intervalId = setInterval(handleRealtime, 10000);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:realtime', handleRealtime);
        window.removeEventListener('abiatar:booth_update', handleRealtime);
      }
      clearInterval(intervalId);
    };
  }, [activeTab, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleDateFilterApply = () => void loadData();

  const copyExecutiveSummary = async () => {
    if (!realtimeData && !brokersReport && !managersReport) return;
    let text = `🏢 *RESUMO EXECUTIVO - ${tenant?.name || 'ABIATAR'}*\n`;
    text += `📅 Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\n`;
    if (realtimeData) {
      text += `📍 *OPERAÇÃO EM TEMPO REAL:*\n`;
      text += `• Plantões Cobertos: ${realtimeData.activeBoothsCount} de ${realtimeData.totalBooths}\n`;
      text += `• Força de Vendas Online: ${realtimeData.onlineBrokersCount} corretores nos estandes\n`;
      text += `• Roletas Realizadas Hoje: ${realtimeData.todayCheckinsCount}\n`;
      text += `• Horas de Plantão Hoje: ${realtimeData.todayTotalHoursFormatted}\n\n`;
    }
    if (managersReport?.managers?.length) {
      text += `👥 *RANKING DE EQUIPES (ROLETAS NO PERÍODO):*\n`;
      managersReport.managers.slice(0, 5).forEach((m: any, idx: number) => {
        text += `${idx + 1}º ${m.nomeGuerra}: ${m.teamTotalCheckIns} roletas (${m.averageCheckInsPerBroker} média/corretor)\n`;
      });
      text += `\n`;
    }
    if (brokersReport?.brokers?.length) {
      text += `🏆 *TOP 5 CORRETORES MAIS ASSÍDUOS:*\n`;
      brokersReport.brokers.slice(0, 5).forEach((b: any, idx: number) => {
        text += `${idx + 1}º ${b.nomeGuerra} (${b.managerName}): ${b.totalCheckIns} roletas | ${b.totalHoursFormatted}\n`;
      });
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert('Resumo executivo copiado para a área de transferência! Pronto para colar no WhatsApp.');
    } else {
      alert('Resumo executivo gerado com sucesso.');
    }
  };

  const filteredBrokers = (brokersReport?.brokers || []).filter((b: any) => {
    const q = searchBroker.toLowerCase().trim();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.nomeGuerra.toLowerCase().includes(q) ||
      b.managerName.toLowerCase().includes(q) ||
      (b.creci && b.creci.toLowerCase().includes(q))
    );
  });

  const renderRealtime = () => {
    if (!realtimeData) return null;
    return (
      <>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: realtimeData.emptyBoothsCount > 0 ? colors.red700 : colors.green700 }]}>
            <Text style={[styles.kpiValue, { fontSize: 22 }]}>
              {realtimeData.activeBoothsCount} / {realtimeData.totalBooths}
            </Text>
            <Text style={styles.kpiLabel}>Plantões Cobertos</Text>
            <Text style={styles.kpiSub}>
              {realtimeData.emptyBoothsCount > 0 ? `${realtimeData.emptyBoothsCount} estande(s) sem corretor` : '100% dos plantões cobertos'}
            </Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.blue700 }]}>
            <Text style={styles.kpiValue}>{realtimeData.onlineBrokersCount}</Text>
            <Text style={styles.kpiLabel}>Corretores Online</Text>
            <Text style={styles.kpiSub}>Força de vendas ativa nos estandes</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.amber700 }]}>
            <Text style={styles.kpiValue}>{realtimeData.todayCheckinsCount}</Text>
            <Text style={styles.kpiLabel}>Roletas do Dia</Text>
            <Text style={styles.kpiSub}>Check-ins realizados hoje</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.coral600 }]}>
            <Text style={styles.kpiValue}>{realtimeData.todayTotalHoursFormatted}</Text>
            <Text style={styles.kpiLabel}>Horas Cumpridas Hoje</Text>
            <Text style={styles.kpiSub}>Tempo presencial validado</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: colors.amber700 }]}>
            <Text style={[styles.kpiValue, { color: colors.amber700 }]}>{realtimeData.invalidatedBrokersCount ?? 0}</Text>
            <Text style={styles.kpiLabel}>Desconsideradas Hoje</Text>
            <Text style={styles.kpiSub}>Presenças descartadas automaticamente</Text>
          </View>
        </View>

        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            {lastSync ? `Atualizado às ${lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Buscando dados ao vivo...'}
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw size={13} color={colors.coral600} />
            <Text style={styles.refreshBtnText}>{refreshing ? 'Atualizando...' : 'Atualizar Tempo Real'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Plantões & Presenças Ativas</Text>
        <View style={{ gap: 14 }}>
          {realtimeData.booths.map((booth: any) => {
            const warn = booth.isUnderstaffed;
            const tone = booth.onlineCount === 0 ? 'danger' : warn ? 'attention' : 'positive';
            return (
              <View key={booth.boothId} style={styles.boothCard}>
                <View style={styles.boothCardHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.boothName}>{booth.boothName}</Text>
                    <Text style={styles.boothAddress}>{booth.address || 'Endereço cadastrado'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusTone[tone as 'danger' | 'attention' | 'positive'].bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusTone[tone as 'danger' | 'attention' | 'positive'].fg }]}>
                      {booth.onlineCount === 0
                        ? `Vazio · ${booth.onlineCount}`
                        : warn
                          ? `Baixa Cobertura · ${booth.onlineCount}/${booth.minRequired}`
                          : `Coberto · ${booth.onlineCount} corretores`}
                    </Text>
                  </View>
                </View>

                {booth.onlineBrokers.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Nenhum corretor com check-in ativo neste estande no momento.</Text>
                  </View>
                ) : (
                  <View style={styles.brokerList}>
                    {booth.onlineBrokers.map((broker: any) => {
                      const badge = formatStageBadge(broker.brokerStage);
                      return (
                        <View key={broker.presenceId} style={styles.brokerLiveItem}>
                          <View style={styles.roletaPosBadge}>
                            <Text style={styles.roletaPosNumber}>#{broker.roletaPosition || '-'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.brokerLiveNameRow}>
                              <Text style={styles.brokerLiveNomeGuerra}>{broker.nomeGuerra}</Text>
                              <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.stageBadgeText, { color: badge.text }]}>{badge.label}</Text>
                              </View>
                            </View>
                            <View style={styles.brokerLiveDetailsRow}>
                              <Text style={styles.brokerLiveDetails}>
                                {broker.roletaName} · Entrada às{' '}
                                {new Date(broker.checkInAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                              <View style={[styles.entryBadge, { backgroundColor: broker.roletaEntryType === 'pos_barra' ? colors.amber100 : colors.green100 }]}>
                                <Text style={[styles.entryBadgeText, { color: broker.roletaEntryType === 'pos_barra' ? colors.amber700 : colors.green700 }]}>
                                  {broker.roletaEntryType === 'pos_barra' ? 'PÓS-BARRA' : 'PONTUAL'}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.timeActiveBox}>
                            <Clock size={12} color={colors.slate600} />
                            <Text style={styles.timeActiveText}>{broker.hoursFormatted}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {booth.invalidatedBrokers?.length > 0 && (
                  <View style={styles.invalidatedBlock}>
                    <Text style={styles.invalidatedTitle}>⛔ Desconsideradas hoje — {booth.invalidatedBrokers.length}</Text>
                    <View style={styles.brokerList}>
                      {booth.invalidatedBrokers.map((broker: any) => (
                        <View key={broker.presenceId} style={[styles.brokerLiveItem, { backgroundColor: colors.amber100 }]}>
                          <View style={[styles.roletaPosBadge, { backgroundColor: colors.amber700 }]}>
                            <Text style={styles.roletaPosNumber}>#{broker.roletaPosition || '-'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.brokerLiveNomeGuerra}>{broker.nomeGuerra}</Text>
                            <View style={styles.brokerLiveDetailsRow}>
                              <Text style={styles.brokerLiveDetails}>
                                {broker.roletaName} · Entrada às{' '}
                                {broker.checkInAt ? new Date(broker.checkInAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'}
                              </Text>
                              <View style={[styles.entryBadge, { backgroundColor: colors.amber700 }]}>
                                <Text style={[styles.entryBadgeText, { color: '#fff' }]}>DESCONSIDERADA</Text>
                              </View>
                            </View>
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
      </>
    );
  };

  const renderBrokers = () => {
    if (!brokersReport) return null;
    return (
      <>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={13} color={colors.slate500} />
            <TextInput
              style={styles.searchInput}
              value={searchBroker}
              onChangeText={setSearchBroker}
              placeholder="Buscar por corretor, gerente ou CRECI..."
              placeholderTextColor={colors.slate400}
            />
          </View>
        </View>
        {boothsList.length > 0 && (
          <View style={styles.pillRow}>
            <TouchableOpacity style={[styles.boothPill, !selectedBoothFilter && styles.boothPillActive]} onPress={() => { setSelectedBoothFilter(''); void loadData(); }}>
              <Text style={[styles.boothPillText, !selectedBoothFilter && styles.boothPillTextActive]}>Todos os Plantões</Text>
            </TouchableOpacity>
            {boothsList.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.boothPill, selectedBoothFilter === b.id && styles.boothPillActive]}
                onPress={() => { setSelectedBoothFilter(b.id); void loadData(); }}
              >
                <Text style={[styles.boothPillText, selectedBoothFilter === b.id && styles.boothPillTextActive]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            Mostrando <Text style={{ fontWeight: '700' }}>{filteredBrokers.length}</Text> de {brokersReport.totalBrokers} corretores no período (
            {formatDateDisplay(brokersReport.period.startDate)} a {formatDateDisplay(brokersReport.period.endDate)})
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          {filteredBrokers.map((broker: any, index: number) => {
            const badge = formatStageBadge(broker.brokerStage);
            return (
              <View key={broker.brokerId} style={styles.brokerCard}>
                <View style={styles.brokerCardHeader}>
                  <View style={styles.brokerCardNameRow}>
                    <View style={styles.rankCircle}>
                      <Text style={styles.rankNumber}>{index + 1}º</Text>
                    </View>
                    <View style={{ minWidth: 0 }}>
                      <View style={styles.brokerCardNameRow}>
                        <Text style={styles.brokerCardName}>{broker.nomeGuerra}</Text>
                        <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.stageBadgeText, { color: badge.text }]}>{badge.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.brokerCardManager}>
                        Equipe: <Text style={{ fontWeight: '700', color: semantic.textPrimary }}>{broker.managerName}</Text>{' '}
                        {broker.creci ? `| CRECI: ${broker.creci}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.weekendBadge, broker.weekendEligible ? { backgroundColor: colors.green100 } : { backgroundColor: colors.amber100 }]}>
                    <Text style={[styles.weekendBadgeText, { color: broker.weekendEligible ? colors.green700 : colors.amber700 }]}>
                      {broker.weekendEligible ? 'Apto Fim de Semana' : `Faltam ${computeWeekendShortfall(broker)} roletas`}
                    </Text>
                  </View>
                </View>
                <View style={styles.metricGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{broker.totalCheckIns}</Text>
                    <Text style={styles.metricLbl}>Roletas</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{broker.totalHoursFormatted}</Text>
                    <Text style={styles.metricLbl}>Horas Presenciais</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{broker.punctualityRate}%</Text>
                    <Text style={styles.metricLbl}>Pontualidade</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, { color: broker.validationRate >= 90 ? colors.green700 : colors.amber700 }]}>
                      {broker.validationRate}%
                    </Text>
                    <Text style={styles.metricLbl}>Aproveitamento</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  const renderManagers = () => {
    if (!managersReport) return null;
    return (
      <>
        <Text style={styles.sectionHeader}>Ranking de Desempenho das Equipes</Text>
        <Text style={styles.sectionDesc}>
          Comparativo de engajamento presencial por equipe de {formatDateDisplay(managersReport.period.startDate)} a{' '}
          {formatDateDisplay(managersReport.period.endDate)}.
        </Text>
        <View style={{ gap: 14 }}>
          {managersReport.managers.map((manager: any, index: number) => (
            <View key={manager.managerId} style={styles.managerCard}>
              <View style={styles.managerHeader}>
                <View style={styles.managerNameRow}>
                  <View style={[styles.managerRankBadge, index === 0 && { backgroundColor: colors.amber100, borderColor: colors.amber700 }]}>
                    <Text style={[styles.managerRankText, index === 0 && { color: colors.amber700 }]}>{index + 1}º</Text>
                  </View>
                  <View>
                    <Text style={styles.managerName}>{manager.nomeGuerra}</Text>
                    <Text style={styles.managerTeamSize}>Time: {manager.teamSize} corretores cadastrados</Text>
                  </View>
                </View>
                <View style={styles.managerTotalBox}>
                  <Text style={styles.managerTotalNumber}>{manager.teamTotalCheckIns}</Text>
                  <Text style={styles.managerTotalLabel}>Roletas da Equipe</Text>
                </View>
              </View>
              <View style={styles.managerKpiRow}>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{manager.averageCheckInsPerBroker}</Text>
                  <Text style={styles.managerKpiLbl}>Média por Corretor</Text>
                </View>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{manager.teamTotalHoursFormatted}</Text>
                  <Text style={styles.managerKpiLbl}>Horas Acumuladas</Text>
                </View>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{manager.teamWeekendEligibleCount} / {manager.teamSize}</Text>
                  <Text style={styles.managerKpiLbl}>Aptos para Sáb/Dom</Text>
                </View>
              </View>
              {manager.topBrokers?.length > 0 && (
                <View style={styles.topBrokersBox}>
                  <Text style={styles.topBrokersTitle}>Destaques da Equipe:</Text>
                  <View style={styles.topBrokersRow}>
                    {manager.topBrokers.map((b: any, bIdx: number) => (
                      <View key={b.brokerId} style={styles.topBrokerPill}>
                        <Text style={styles.topBrokerText}>
                          {bIdx + 1}º {b.nomeGuerra} ({b.checkIns} roletas | {b.hoursFormatted})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderBooths = () => {
    if (!boothsReport) return null;
    return (
      <>
        <Text style={styles.sectionHeader}>Ocupação & Demanda dos Plantões de Vendas</Text>
        <Text style={styles.sectionDesc}>
          Análise do fluxo de força de vendas por estande de {formatDateDisplay(boothsReport.period.startDate)} a{' '}
          {formatDateDisplay(boothsReport.period.endDate)}.
        </Text>
        <View style={{ gap: 14 }}>
          {boothsReport.booths.map((booth: any, idx: number) => (
            <View key={booth.boothId} style={styles.boothCard}>
              <View style={styles.boothCardHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.boothName}>{idx + 1}º {booth.boothName}</Text>
                  <Text style={styles.boothAddress}>{booth.address || 'Endereço cadastrado'}</Text>
                </View>
                <View style={[styles.managerTotalBox, { borderColor: colors.coral300 }]}>
                  <Text style={[styles.managerTotalNumber, { color: colors.coral600 }]}>{booth.totalCheckIns}</Text>
                  <Text style={[styles.managerTotalLabel, { color: colors.slate600 }]}>Roletas Realizadas</Text>
                </View>
              </View>
              <View style={styles.boothKpiGrid}>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{booth.uniqueBrokersCount}</Text>
                  <Text style={styles.managerKpiLbl}>Corretores Distintos</Text>
                </View>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{booth.totalHoursFormatted}</Text>
                  <Text style={styles.managerKpiLbl}>Horas de Cobertura</Text>
                </View>
                <View style={styles.managerKpiItem}>
                  <Text style={styles.managerKpiVal}>{booth.peakHourFormatted}</Text>
                  <Text style={styles.managerKpiLbl}>Horário de Pico</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  };

  const dateFilterVisible = activeTab !== 'realtime';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroBadge}>
            <Trophy size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Diretoria · Torre de controle</Text>
          </View>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Inteligência operacional.</Text>
              <Text style={styles.heroSubtitle}>Presenças reais na operação, em tempo real e no período.</Text>
            </View>
            <TouchableOpacity style={styles.heroCopyBtn} onPress={() => void copyExecutiveSummary()}>
              <Copy size={14} color="#fff" />
              <Text style={styles.heroCopyBtnText}>Copiar Resumo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
              <Icon size={13} color={activeTab === key ? '#fff' : colors.slate500} />
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {dateFilterVisible && (
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Filtrar Período:</Text>
            <View style={styles.presetRow}>
              {(
                [
                  { key: 'today', label: 'Hoje' },
                  { key: 'week', label: 'Esta Semana' },
                  { key: 'month', label: 'Este Mês' },
                  { key: 'custom', label: 'Personalizado' },
                ] as { key: PeriodPreset; label: string }[]
              ).map((p) => (
                <TouchableOpacity key={p.key} style={[styles.presetButton, periodPreset === p.key && styles.presetButtonActive]} onPress={() => setPeriodPreset(p.key)}>
                  <Text style={[styles.presetText, periodPreset === p.key && styles.presetTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {periodPreset === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateInputLabel}>Data Inicial (AAAA-MM-DD)</Text>
                  <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-08-01" placeholderTextColor={colors.slate400} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateInputLabel}>Data Final (AAAA-MM-DD)</Text>
                  <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-08-31" placeholderTextColor={colors.slate400} />
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleDateFilterApply}>
                  <Text style={styles.primaryBtnText}>Filtrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.coral600} />
          </View>
        ) : (
          <>
            {activeTab === 'realtime' && renderRealtime()}
            {activeTab === 'brokers' && renderBrokers()}
            {activeTab === 'managers' && renderManagers()}
            {activeTab === 'booths' && renderBooths()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: radius.lg, padding: 20, backgroundColor: colors.navy900, ...shadow.card },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 13,
  },
  heroCopyBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card,
  },
  tabActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  tabText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  filterCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, gap: 10, ...shadow.card,
  },
  filterLabel: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetButton: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.md, backgroundColor: colors.slate100, borderWidth: 1, borderColor: semantic.border },
  presetButtonActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  presetText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  presetTextActive: { color: '#fff' },
  customDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  dateInputLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 10.5, marginBottom: 5 },
  input: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 11, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 18,
  },
  primaryBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  loadingBox: { padding: 40, alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    flex: 1, minWidth: 170,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    borderLeftWidth: 4, padding: 14, ...shadow.card,
  },
  kpiValue: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 29, letterSpacing: -1.4 },
  kpiLabel: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 11.5, marginTop: 2 },
  kpiSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 3 },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  syncText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.coral300, backgroundColor: semantic.card,
  },
  refreshBtnText: { color: colors.coral600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  sectionHeader: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14.5, marginTop: 4 },
  sectionDesc: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, lineHeight: 17 },
  boothCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  boothCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  boothName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14, letterSpacing: -0.2 },
  boothAddress: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 2 },
  statusBadge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.full },
  statusBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  emptyBox: { backgroundColor: colors.slate050, borderRadius: radius.md, padding: 12 },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic' },
  brokerList: { gap: 8 },
  brokerLiveItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.slate050, borderRadius: radius.md, padding: 10,
  },
  roletaPosBadge: {
    width: 38, height: 26, borderRadius: 7, backgroundColor: colors.navy800,
    alignItems: 'center', justifyContent: 'center',
  },
  roletaPosNumber: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 11 },
  brokerLiveNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brokerLiveNomeGuerra: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 12.5 },
  stageBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.full },
  stageBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 8.5 },
  brokerLiveDetailsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  brokerLiveDetails: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  entryBadge: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.full },
  entryBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 8.5 },
  timeActiveBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeActiveText: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  invalidatedBlock: { gap: 8 },
  invalidatedTitle: { color: colors.amber700, fontFamily: font.body, fontWeight: '800', fontSize: 11.5 },
  searchRow: { gap: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boothPill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card },
  boothPillActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  boothPillText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  boothPillTextActive: { color: '#fff' },
  summaryBar: {
    backgroundColor: colors.slate050, borderRadius: radius.md, padding: 11,
    borderWidth: 1, borderColor: semantic.border,
  },
  summaryText: { color: semantic.textSecondary, fontFamily: font.body, fontSize: 11.5 },
  brokerCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 14, gap: 12, ...shadow.card,
  },
  brokerCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  brokerCardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankCircle: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center',
  },
  rankNumber: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 13 },
  brokerCardName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 13.5 },
  brokerCardManager: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 2 },
  weekendBadge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.full },
  weekendBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  metricGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: colors.slate050, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border,
  },
  metricItem: { flex: 1, minWidth: 90, alignItems: 'center', paddingVertical: 10 },
  metricVal: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 17, letterSpacing: -0.4 },
  metricLbl: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 9.5, marginTop: 2 },
  managerCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  managerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  managerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  managerRankBadge: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: colors.navy800, borderWidth: 1, borderColor: colors.navy800,
    alignItems: 'center', justifyContent: 'center',
  },
  managerRankText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  managerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 13.5 },
  managerTeamSize: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 1 },
  managerTotalBox: {
    alignItems: 'center', paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border, backgroundColor: colors.slate050,
  },
  managerTotalNumber: { color: colors.coral600, fontFamily: font.display, fontWeight: '800', fontSize: 18, letterSpacing: -0.4 },
  managerTotalLabel: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 9.5 },
  managerKpiRow: { flexDirection: 'row', flexWrap: 'wrap' },
  managerKpiItem: { flex: 1, minWidth: 90, alignItems: 'center' },
  managerKpiVal: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  managerKpiLbl: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '600', fontSize: 9.5, marginTop: 2, textAlign: 'center' },
  topBrokersBox: { gap: 8 },
  topBrokersTitle: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  topBrokersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topBrokerPill: {
    backgroundColor: colors.coral050, borderWidth: 1, borderColor: colors.coral300, borderRadius: radius.full,
    paddingVertical: 6, paddingHorizontal: 11,
  },
  topBrokerText: { color: colors.coral700, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  boothKpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});