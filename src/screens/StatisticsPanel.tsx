import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import ScreenCode from '../components/ScreenCode';
import api from '../services/api';

type TabType = 'realtime' | 'brokers' | 'managers' | 'booths';
type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export default function StatisticsPanel({ onBack }: { onBack: () => void }) {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('realtime');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');

  // Filtros de Data
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Busca e Filtros
  const [searchBroker, setSearchBroker] = useState('');
  const [selectedBoothFilter, setSelectedBoothFilter] = useState<string>('');

  // Estados dos Dados
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [brokersReport, setBrokersReport] = useState<any>(null);
  const [managersReport, setManagersReport] = useState<any>(null);
  const [boothsReport, setBoothsReport] = useState<any>(null);
  const [boothsList, setBoothsList] = useState<any[]>([]);

  // Inicializa datas com base no Preset
  useEffect(() => {
    applyPeriodPreset(periodPreset);
  }, [periodPreset]);

  // Carrega dados iniciais
  useEffect(() => {
    void loadBoothsList();
    void loadData();
  }, [activeTab]);

  function getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getStartOfWeekString(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
    const monday = new Date(d.setDate(diff));
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }

  function getStartOfMonthString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function applyPeriodPreset(preset: PeriodPreset) {
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
  }

  async function loadBoothsList() {
    try {
      const res = await api.get('/booths');
      setBoothsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.warn('Erro ao carregar lista de plantões:', e);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'realtime') {
        const res = await api.get('/presences/reports/realtime');
        setRealtimeData(res.data);
      } else if (activeTab === 'brokers') {
        const res = await api.get('/presences/reports/brokers', {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            boothId: selectedBoothFilter || undefined,
          },
        });
        setBrokersReport(res.data);
      } else if (activeTab === 'managers') {
        const res = await api.get('/presences/reports/managers', {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        });
        setManagersReport(res.data);
      } else if (activeTab === 'booths') {
        const res = await api.get('/presences/reports/booths', {
          params: {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        });
        setBoothsReport(res.data);
      }
    } catch (error: any) {
      console.error('Erro ao carregar relatório executivo:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
  }

  function handleDateFilterApply() {
    void loadData();
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
    return { label: 'Corretor', bg: '#f3f4f6', text: '#374151' };
  }

  function handleCopyExecutiveSummary() {
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
      void navigator.clipboard.writeText(text);
      Alert.alert('ABIATAR', 'Resumo executivo copiado para a área de transferência! Pronto para colar no WhatsApp.');
    } else {
      Alert.alert('ABIATAR', 'Resumo executivo gerado com sucesso.');
    }
  }

  // Filtragem de corretores pelo campo de busca
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

  return (
    <View style={styles.container}>
      <ScreenCode code="DR-03" />

      {/* HEADER DA DIRETORIA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Voltar ao Painel</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.title}>Torre de Controle & Relatórios</Text>
            <Text style={styles.headerSubtitle}>Inteligência Operacional da Força de Vendas</Text>
          </View>
          <TouchableOpacity style={styles.shareSummaryButton} onPress={handleCopyExecutiveSummary}>
            <Text style={styles.shareSummaryText}>📋 Copiar Resumo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ABAS SUPERIORES DE NAVEGAÇÃO */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'realtime' && styles.tabItemActive]}
          onPress={() => setActiveTab('realtime')}
        >
          <Text style={[styles.tabText, activeTab === 'realtime' && styles.tabTextActive]}>
            📡 Tempo Real
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'brokers' && styles.tabItemActive]}
          onPress={() => setActiveTab('brokers')}
        >
          <Text style={[styles.tabText, activeTab === 'brokers' && styles.tabTextActive]}>
            👤 Corretores
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'managers' && styles.tabItemActive]}
          onPress={() => setActiveTab('managers')}
        >
          <Text style={[styles.tabText, activeTab === 'managers' && styles.tabTextActive]}>
            👥 Equipes & Gerentes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'booths' && styles.tabItemActive]}
          onPress={() => setActiveTab('booths')}
        >
          <Text style={[styles.tabText, activeTab === 'booths' && styles.tabTextActive]}>
            🏢 Plantões
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        {/* BARRA DE FILTRO DE DATA (EXIBIDA NAS ABAS HISTÓRICAS) */}
        {activeTab !== 'realtime' && (
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Filtrar Período:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[styles.presetButton, periodPreset === 'today' && styles.presetButtonActive]}
                onPress={() => setPeriodPreset('today')}
              >
                <Text style={[styles.presetText, periodPreset === 'today' && styles.presetTextActive]}>Hoje</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetButton, periodPreset === 'week' && styles.presetButtonActive]}
                onPress={() => setPeriodPreset('week')}
              >
                <Text style={[styles.presetText, periodPreset === 'week' && styles.presetTextActive]}>Esta Semana</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetButton, periodPreset === 'month' && styles.presetButtonActive]}
                onPress={() => setPeriodPreset('month')}
              >
                <Text style={[styles.presetText, periodPreset === 'month' && styles.presetTextActive]}>Este Mês</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetButton, periodPreset === 'custom' && styles.presetButtonActive]}
                onPress={() => setPeriodPreset('custom')}
              >
                <Text style={[styles.presetText, periodPreset === 'custom' && styles.presetTextActive]}>Personalizado</Text>
              </TouchableOpacity>
            </View>

            {periodPreset === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateInputLabel}>Data Inicial (AAAA-MM-DD)</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    style={styles.dateInput}
                    placeholder="2026-08-01"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateInputLabel}>Data Final (AAAA-MM-DD)</Text>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    style={styles.dateInput}
                    placeholder="2026-08-31"
                  />
                </View>
                <TouchableOpacity style={styles.applyDateButton} onPress={handleDateFilterApply}>
                  <Text style={styles.applyDateButtonText}>Filtrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#1c1c1e" /></View>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. ABA DE TEMPO REAL (TORRE DE CONTROLE)                                 */}
            {/* ========================================================================= */}
            {activeTab === 'realtime' && realtimeData && (
              <>
                {/* 4 CARDS HERO DE ALTO IMPACTO */}
                <View style={styles.heroGrid}>
                  <View style={[styles.heroCard, { borderLeftColor: realtimeData.emptyBoothsCount > 0 ? '#ef4444' : '#10b981' }]}>
                    <Text style={styles.heroNumber}>{realtimeData.activeBoothsCount} / {realtimeData.totalBooths}</Text>
                    <Text style={styles.heroTitle}>Plantões Cobertos</Text>
                    <Text style={styles.heroSubtitle}>
                      {realtimeData.emptyBoothsCount > 0
                        ? `⚠️ ${realtimeData.emptyBoothsCount} estande(s) sem corretor`
                        : '✅ 100% dos plantões cobertos'}
                    </Text>
                  </View>

                  <View style={[styles.heroCard, { borderLeftColor: '#3b82f6' }]}>
                    <Text style={styles.heroNumber}>{realtimeData.onlineBrokersCount}</Text>
                    <Text style={styles.heroTitle}>Corretores Online</Text>
                    <Text style={styles.heroSubtitle}>Força de vendas ativa nos estandes</Text>
                  </View>

                  <View style={[styles.heroCard, { borderLeftColor: '#f59e0b' }]}>
                    <Text style={styles.heroNumber}>{realtimeData.todayCheckinsCount}</Text>
                    <Text style={styles.heroTitle}>Roletas do Dia</Text>
                    <Text style={styles.heroSubtitle}>Check-ins realizados hoje</Text>
                  </View>

                  <View style={[styles.heroCard, { borderLeftColor: '#8b5cf6' }]}>
                    <Text style={styles.heroNumber}>{realtimeData.todayTotalHoursFormatted}</Text>
                    <Text style={styles.heroTitle}>Horas Cumpridas Hoje</Text>
                    <Text style={styles.heroSubtitle}>Tempo presencial validado</Text>
                  </View>
                </View>

                {/* BOTÃO ATUALIZAR TEMPO REAL */}
                <TouchableOpacity
                  style={[styles.refreshButton, refreshing && { opacity: 0.7 }]}
                  onPress={handleRefresh}
                  disabled={refreshing}
                >
                  <Text style={styles.refreshButtonText}>
                    {refreshing ? 'Atualizando...' : '🔄 Atualizar Tempo Real'}
                  </Text>
                </TouchableOpacity>

                {/* LISTAGEM DE PLANTÕES EM TEMPO REAL */}
                <Text style={styles.sectionHeader}>Plantões & Presenças Ativas</Text>
                <View style={{ gap: 14 }}>
                  {realtimeData.booths.map((booth: any) => (
                    <View key={booth.boothId} style={styles.boothLiveCard}>
                      <View style={styles.boothLiveHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.boothLiveName}>{booth.boothName}</Text>
                          <Text style={styles.boothLiveAddress}>{booth.address || 'Endereço cadastrado'}</Text>
                        </View>

                        <View style={[styles.statusBadge, booth.isUnderstaffed ? styles.statusBadgeWarn : styles.statusBadgeOk]}>
                          <Text style={[styles.statusBadgeText, booth.isUnderstaffed ? styles.statusBadgeTextWarn : styles.statusBadgeTextOk]}>
                            {booth.onlineCount === 0
                              ? '🔴 Vazio'
                              : booth.isUnderstaffed
                              ? `⚠️ Baixa Cobertura (${booth.onlineCount}/${booth.minRequired})`
                              : `🟢 Coberto (${booth.onlineCount} corretores)`}
                          </Text>
                        </View>
                      </View>

                      {booth.onlineBrokers.length === 0 ? (
                        <View style={styles.emptyBoothBox}>
                          <Text style={styles.emptyBoothText}>Nenhum corretor com check-in ativo neste estande no momento.</Text>
                        </View>
                      ) : (
                        <View style={styles.brokerListInBooth}>
                          {booth.onlineBrokers.map((broker: any) => {
                            const badge = formatStageBadge(broker.brokerStage);
                            return (
                              <View key={broker.presenceId} style={styles.brokerLiveItem}>
                                <View style={styles.roletaPosBadge}>
                                  <Text style={styles.roletaPosNumber}>#{broker.roletaPosition || '-'}</Text>
                                </View>

                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.brokerLiveNomeGuerra}>{broker.nomeGuerra}</Text>
                                    <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
                                      <Text style={[styles.stageBadgeText, { color: badge.text }]}>{badge.label}</Text>
                                    </View>
                                  </View>
                                  <Text style={styles.brokerLiveDetails}>
                                    {broker.roletaName} | Entrada às {new Date(broker.checkInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>

                                <View style={styles.timeActiveBox}>
                                  <Text style={styles.timeActiveText}>⏱️ {broker.hoursFormatted}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ========================================================================= */}
            {/* 2. ABA DE CORRETORES (PRODUTIVIDADE E ROLETAS)                            */}
            {/* ========================================================================= */}
            {activeTab === 'brokers' && brokersReport && (
              <>
                {/* BARRA DE BUSCA E FILTRO POR PLANTÃO */}
                <View style={styles.searchBarRow}>
                  <TextInput
                    value={searchBroker}
                    onChangeText={setSearchBroker}
                    style={styles.searchInput}
                    placeholder="🔍 Buscar por corretor, gerente ou CRECI..."
                  />

                  {boothsList.length > 0 && (
                    <View style={styles.boothFilterScroll}>
                      <TouchableOpacity
                        style={[styles.boothFilterPill, !selectedBoothFilter && styles.boothFilterPillActive]}
                        onPress={() => { setSelectedBoothFilter(''); void loadData(); }}
                      >
                        <Text style={[styles.boothFilterText, !selectedBoothFilter && styles.boothFilterTextActive]}>Todos os Plantões</Text>
                      </TouchableOpacity>
                      {boothsList.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.boothFilterPill, selectedBoothFilter === b.id && styles.boothFilterPillActive]}
                          onPress={() => { setSelectedBoothFilter(b.id); void loadData(); }}
                        >
                          <Text style={[styles.boothFilterText, selectedBoothFilter === b.id && styles.boothFilterTextActive]}>{b.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* RESUMO TOTAL DA FORÇA DE VENDAS */}
                <View style={styles.summaryBar}>
                  <Text style={styles.summaryText}>
                    Mostrando <Text style={{ fontWeight: 'bold' }}>{filteredBrokers.length}</Text> de {brokersReport.totalBrokers} corretores no período ({formatDateDisplay(brokersReport.period.startDate)} a {formatDateDisplay(brokersReport.period.endDate)})
                  </Text>
                </View>

                {/* LISTAGEM DE CORRETORES (CARDS DE PRODUTIVIDADE) */}
                <View style={{ gap: 12 }}>
                  {filteredBrokers.map((broker: any, index: number) => {
                    const badge = formatStageBadge(broker.brokerStage);
                    return (
                      <View key={broker.brokerId} style={styles.brokerCard}>
                        {/* CABEÇALHO DO CORRETOR */}
                        <View style={styles.brokerCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.rankCircle}>
                              <Text style={styles.rankNumber}>{index + 1}º</Text>
                            </View>
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.brokerCardName}>{broker.nomeGuerra}</Text>
                                <View style={[styles.stageBadge, { backgroundColor: badge.bg }]}>
                                  <Text style={[styles.stageBadgeText, { color: badge.text }]}>{badge.label}</Text>
                                </View>
                              </View>
                              <Text style={styles.brokerCardManager}>
                                Equipe: <Text style={{ fontWeight: '600', color: '#1c1c1e' }}>{broker.managerName}</Text> {broker.creci ? `| CRECI: ${broker.creci}` : ''}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.weekendBadge, broker.weekendEligible ? styles.weekendBadgeOk : styles.weekendBadgePending]}>
                            <Text style={[styles.weekendBadgeText, broker.weekendEligible ? styles.weekendBadgeTextOk : styles.weekendBadgeTextPending]}>
                              {broker.weekendEligible ? '🟢 Apto Fim de Semana' : `🟡 Faltam ${Math.max(0, 5 - broker.currentWeekValidRoletas)} roletas`}
                            </Text>
                          </View>
                        </View>

                        {/* GRID DE MÉTRICAS OPERACIONAIS */}
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
                            <Text style={[styles.metricVal, { color: broker.validationRate >= 90 ? '#15803d' : '#b45309' }]}>
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
            )}

            {/* ========================================================================= */}
            {/* 3. ABA DE EQUIPES & GERENTES (RANKING COMPARATIVO)                        */}
            {/* ========================================================================= */}
            {activeTab === 'managers' && managersReport && (
              <>
                <Text style={styles.sectionHeader}>Ranking de Desempenho das Equipes</Text>
                <Text style={styles.sectionDesc}>
                  Comparativo de engajamento presencial por equipe de {formatDateDisplay(managersReport.period.startDate)} a {formatDateDisplay(managersReport.period.endDate)}.
                </Text>

                <View style={{ gap: 14 }}>
                  {managersReport.managers.map((manager: any, index: number) => (
                    <View key={manager.managerId} style={styles.managerCard}>
                      <View style={styles.managerCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.managerRankBadge, index === 0 && { backgroundColor: '#fef08a', borderColor: '#eab308' }]}>
                            <Text style={[styles.managerRankText, index === 0 && { color: '#854d0e' }]}>{index + 1}º</Text>
                          </View>
                          <View>
                            <Text style={styles.managerName}>{manager.nomeGuerra}</Text>
                            <Text style={styles.managerTeamSize}>Time: {manager.teamSize} corretores cadastrados</Text>
                          </View>
                        </View>

                        <View style={styles.managerTotalRoletasBox}>
                          <Text style={styles.managerTotalRoletasNumber}>{manager.teamTotalCheckIns}</Text>
                          <Text style={styles.managerTotalRoletasLabel}>Roletas da Equipe</Text>
                        </View>
                      </View>

                      {/* KPI ROW DO GERENTE */}
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

                      {/* TOP 3 CORRETORES DA EQUIPE */}
                      {manager.topBrokers?.length > 0 && (
                        <View style={styles.topBrokersBox}>
                          <Text style={styles.topBrokersTitle}>Destaques da Equipe:</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {manager.topBrokers.map((b: any, bIdx: number) => (
                              <View key={b.brokerId} style={styles.topBrokerPill}>
                                <Text style={styles.topBrokerText}>
                                  ⭐ {bIdx + 1}º {b.nomeGuerra} ({b.checkIns} roletas | {b.hoursFormatted})
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
            )}

            {/* ========================================================================= */}
            {/* 4. ABA DE PLANTÕES (OCUPAÇÃO E DEMANDA)                                   */}
            {/* ========================================================================= */}
            {activeTab === 'booths' && boothsReport && (
              <>
                <Text style={styles.sectionHeader}>Ocupação & Demanda dos Plantões de Vendas</Text>
                <Text style={styles.sectionDesc}>
                  Análise do fluxo de força de vendas por estande de {formatDateDisplay(boothsReport.period.startDate)} a {formatDateDisplay(boothsReport.period.endDate)}.
                </Text>

                <View style={{ gap: 14 }}>
                  {boothsReport.booths.map((booth: any, idx: number) => (
                    <View key={booth.boothId} style={styles.boothReportCard}>
                      <View style={styles.boothReportHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.boothReportName}>{idx + 1}º {booth.boothName}</Text>
                          <Text style={styles.boothReportAddress}>{booth.address || 'Endereço cadastrado'}</Text>
                        </View>

                        <View style={styles.boothTotalBox}>
                          <Text style={styles.boothTotalVal}>{booth.totalCheckIns}</Text>
                          <Text style={styles.boothTotalLbl}>Roletas Realizadas</Text>
                        </View>
                      </View>

                      <View style={styles.boothKpiGrid}>
                        <View style={styles.boothKpiItem}>
                          <Text style={styles.boothKpiVal}>{booth.uniqueBrokersCount}</Text>
                          <Text style={styles.boothKpiLbl}>Corretores Distintos</Text>
                        </View>

                        <View style={styles.boothKpiItem}>
                          <Text style={styles.boothKpiVal}>{booth.totalHoursFormatted}</Text>
                          <Text style={styles.boothKpiLbl}>Horas de Cobertura</Text>
                        </View>

                        <View style={styles.boothKpiItem}>
                          <Text style={styles.boothKpiVal}>{booth.peakHourFormatted}</Text>
                          <Text style={styles.boothKpiLbl}>Horário de Pico</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f8' },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1c1c1e',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  backText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '700',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  shareSummaryButton: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  shareSummaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#1c1c1e',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#1c1c1e',
    fontWeight: '800',
  },
  content: { padding: 16, paddingBottom: 48, maxWidth: 860, width: '100%', alignSelf: 'center' },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  presetButtonActive: {
    backgroundColor: '#1c1c1e',
    borderColor: '#1c1c1e',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  presetTextActive: {
    color: '#fff',
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateInputLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
  },
  applyDateButton: {
    backgroundColor: '#1c1c1e',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  applyDateButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  heroCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 5,
  },
  heroNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  refreshButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 18,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  sectionHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 14,
  },
  boothLiveCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  boothLiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  boothLiveName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  boothLiveAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeOk: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeWarn: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextOk: {
    color: '#15803d',
  },
  statusBadgeTextWarn: {
    color: '#b91c1c',
  },
  emptyBoothBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyBoothText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  brokerListInBooth: {
    padding: 10,
    gap: 8,
  },
  brokerLiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  roletaPosBadge: {
    backgroundColor: '#1c1c1e',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roletaPosNumber: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  brokerLiveNomeGuerra: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  brokerLiveDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  stageBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeActiveBox: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  timeActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  searchBarRow: {
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  boothFilterScroll: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  boothFilterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  boothFilterPillActive: {
    backgroundColor: '#1c1c1e',
    borderColor: '#1c1c1e',
  },
  boothFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },
  boothFilterTextActive: {
    color: '#fff',
  },
  summaryBar: {
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 12,
    color: '#6b7280',
  },
  brokerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  brokerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  brokerCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  brokerCardManager: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  weekendBadge: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 5,
  },
  weekendBadgeOk: {
    backgroundColor: '#dcfce7',
  },
  weekendBadgePending: {
    backgroundColor: '#fef3c7',
  },
  weekendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weekendBadgeTextOk: {
    color: '#15803d',
  },
  weekendBadgeTextPending: {
    color: '#b45309',
  },
  metricGrid: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  metricLbl: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  managerCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  managerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  managerRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerRankText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
  },
  managerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  managerTeamSize: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  managerTotalRoletasBox: {
    alignItems: 'flex-end',
  },
  managerTotalRoletasNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1c1c1e',
  },
  managerTotalRoletasLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  managerKpiRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  managerKpiItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  managerKpiVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  managerKpiLbl: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  topBrokersBox: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  topBrokersTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  topBrokerPill: {
    backgroundColor: '#eef2ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  topBrokerText: {
    fontSize: 11,
    color: '#3730a3',
    fontWeight: '600',
  },
  boothReportCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  boothReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boothReportName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  boothReportAddress: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  boothTotalBox: {
    alignItems: 'flex-end',
  },
  boothTotalVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1c1c1e',
  },
  boothTotalLbl: {
    fontSize: 11,
    color: '#6b7280',
  },
  boothKpiGrid: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  boothKpiItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  boothKpiVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  boothKpiLbl: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
});
