// src/screens/StatisticsPanel.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  FlatList, 
  Platform 
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface HeatmapItem {
  dayOfWeek: number;
  hour: number;
  checkInCount: number;
}

interface BrokerStat {
  brokerId: string;
  name: string;
  nomeGuerra: string;
  presencePercentage: number;
  completedPeriods: number;
  monthlyGoal: number;
}

interface StatisticsPanelProps {
  onBack: () => void;
}

export default function StatisticsPanel({ onBack }: StatisticsPanelProps) {
  const { tenant, user } = useAuth();
  const [heatmap, setHeatmap] = useState<HeatmapItem[]>([]);
  const [brokerStats, setBrokerStats] = useState<BrokerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [booths, setBooths] = useState<any[]>([]);
  const [error, setError] = useState('');

  const primaryColor = tenant?.primary_color || '#1c1c1e';

  // Dias da semana correspondentes aos números do Postgres
  const daysOfWeekNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    async function loadInitialData() {
      try {
        setError('');
        // 1. Busca os plantões cadastrados para a Diretoria escolher qual analisar
        const boothsRes = await api.get('/booths');
        setBooths(boothsRes.data);

        if (boothsRes.data.length > 0) {
          setSelectedBoothId(boothsRes.data[0].id); // Assume o primeiro como padrão
        }
      } catch (err) {
        setError('Falha ao carregar as informações analíticas.');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // 2. Efeito: Toda vez que a Diretora mudar o plantão selecionado, busca o mapa de calor dele
  useEffect(() => {
    if (!selectedBoothId || !user?.id) return;

    async function loadAnalytics() {
      try {
        setLoading(true);
        // Busca o mapa de calor de demanda horária do plantão na API
        const demandRes = await api.get(`/presences/statistics/booth-demand/${selectedBoothId}`);
        setHeatmap(demandRes.data.heatmap);

        // A Diretoria visualiza todos os Corretores ativos/em carência do tenant.
        const teamRes = await api.get('/users/active-brokers');
        const statsPromises = teamRes.data.map(async (member: any) => {
          const statRes = await api.get(`/presences/statistics/broker/${member.id}`, { params: { boothId: selectedBoothId } });
          return {
            brokerId: member.id,
            name: member.name,
            nomeGuerra: member.nome_guerra,
            presencePercentage: statRes.data.presencePercentage,
            completedPeriods: statRes.data.completedPeriods,
            monthlyGoal: statRes.data.monthlyGoal,
          };
        });

        const resolvedStats = await Promise.all(statsPromises);
        setBrokerStats(resolvedStats);
      } catch (err: any) {
        console.error('[BI - ERRO] Falha ao carregar inteligência de dados:', err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [selectedBoothId]);

  // Função auxiliar de cores para o Mapa de Calor (Maior frequência = Cor mais escura)
  const getHeatmapColor = (count: number) => {
    if (count === 0) return '#fafafc';
    if (count <= 2) return '#ffeb3b'; // Baixo (Amarelo)
    if (count <= 5) return '#ff9800'; // Médio (Laranja)
    return '#ff3b30'; // Alto fluxo (Vermelho)
  };

  if (loading && booths.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Carregando inteligência de dados...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Botão de voltar ao painel principal */}
      <TouchableOpacity style={styles.backHeader} onPress={onBack}>
        <Text style={[styles.backHeaderText, { color: primaryColor }]}>← Voltar ao Painel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Inteligência de Plantão (BI)</Text>
      <Text style={styles.subtitle}>Analise a assiduidade do time e os scores de demanda horária</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* SEÇÃO A: SELETOR DE PLANTÕES */}
      <Text style={styles.sectionHeader}>Selecione o Plantão para Análise</Text>
      <View style={styles.boothSelector}>
        {booths.map((booth) => (
          <TouchableOpacity
            key={booth.id}
            style={[
              styles.boothTab,
              selectedBoothId === booth.id ? { backgroundColor: primaryColor } : null
            ]}
            onPress={() => setSelectedBoothId(booth.id)}
          >
            <Text style={[
              styles.boothTabText,
              selectedBoothId === booth.id ? { color: '#FFF' } : { color: '#8e8e93' }
            ]}>
              {booth.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SEÇÃO B: MAPA DE CALOR DE DEMANDA HISTÓRICA (HEATMAP) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔥 Score de Demanda por Horário (Mapa de Calor)</Text>
        <Text style={styles.cardDesc}>Identifique de forma estatística os momentos de pico e ociosidade.</Text>
        
        {loading ? (
          <ActivityIndicator color={primaryColor} style={{ marginVertical: 30 }} />
        ) : heatmap.length === 0 ? (
          <Text style={styles.emptyText}>Histórico insuficiente de check-ins para gerar estatísticas.</Text>
        ) : (
          <View style={styles.heatmapContainer}>
            {heatmap.map((item, index) => (
              <View key={index} style={styles.heatmapRow}>
                <Text style={styles.dayLabel}>{daysOfWeekNames[item.dayOfWeek]}</Text>
                <View style={styles.hoursContainer}>
                  <Text style={styles.hourText}>{item.hour}h</Text>
                  <View style={[styles.heatBox, { backgroundColor: getHeatmapColor(item.checkInCount) }]}>
                    <Text style={[styles.heatCount, item.checkInCount > 0 ? { color: '#1c1c1e' } : null]}>
                      {item.checkInCount}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* SEÇÃO C: ASSIDUIDADE MENSAL DO TIME */}
      <Text style={styles.subHeader}>Porcentagem de Assiduidade Mensal (Meta: 20 períodos)</Text>
      <FlatList
        data={brokerStats}
        keyExtractor={(item) => item.brokerId}
        style={styles.list}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum corretor ativo no time no momento.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.brokerName}>{item.nomeGuerra} ({item.name})</Text>
              <View>
                <Text style={[styles.percentageText, { color: primaryColor }]}>{item.presencePercentage}%</Text>
                <Text style={styles.statMeta}>{item.completedPeriods}/{item.monthlyGoal} períodos</Text>
              </View>
            </View>
            
            {/* Barra de progresso visual horizontal de assiduidade */}
            <View style={styles.progressBg}>
              <View style={[
                styles.progressBar, 
                { width: `${item.presencePercentage}%`, backgroundColor: primaryColor }
              ]} />
            </View>
          </View>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8e8e93',
  },
  backHeader: {
    marginTop: 40,
    marginBottom: 20,
  },
  backHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 32,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8e8e93',
    marginBottom: 12,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  subHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 16,
    marginTop: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  boothSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    marginBottom: 24,
  },
  boothTab: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  boothTabText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  card: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8e8e93',
    marginBottom: 20,
  },
  heatmapContainer: {
    width: '100%',
  },
  heatmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    paddingVertical: 8,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a3a3c',
    width: 80,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourText: {
    fontSize: 13,
    color: '#8e8e93',
    marginRight: 12,
    fontWeight: '600',
  },
  heatBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heatCount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8e8e93',
  },
  list: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  statCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brokerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statMeta: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 2,
  },
  progressBg: {
    height: 10,
    backgroundColor: '#e5e5ea',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  emptyText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    marginVertical: 20,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
});