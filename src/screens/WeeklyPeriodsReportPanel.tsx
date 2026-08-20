import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface WeeklyPeriodsReportPanelProps { onBack: () => void; }

export default function WeeklyPeriodsReportPanel({ onBack }: WeeklyPeriodsReportPanelProps) {
  const { user, tenant } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [weekStart, setWeekStart] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const role = user?.role;
  const roleTitle = role === 'diretoria_level_1' ? 'Relatório Global de Períodos' : role === 'gerencia_level_2' ? 'Relatório da Minha Equipe' : role === 'recepcao_level_3' ? 'Relatório dos Meus Plantões' : 'Meu Relatório de Períodos';

  const load = async (selectedWeek?: string) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/reports/weekly-periods', { params: selectedWeek ? { weekStart: selectedWeek } : {} });
      setData(response.data);
      setWeekStart(response.data.report?.week_start);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível carregar o relatório semanal.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color={primaryColor} /><Text style={styles.muted}>Carregando relatório semanal...</Text></View>;

  const report = data?.report;
  const items = data?.items || [];
  const totals = report?.totals || {};

  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={onBack} style={styles.back}><Text style={[styles.backText, { color: primaryColor }]}>← Voltar</Text></TouchableOpacity>
    <Text style={styles.title}>{roleTitle}</Text>
    <Text style={styles.subtitle}>Semana de {report?.week_start || '—'} a {report?.week_end || '—'} · Histórico preservado por fechamento semanal</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.weekRow}>
      <TouchableOpacity style={[styles.weekButton, { borderColor: primaryColor }]} onPress={() => void load()}><Text style={[styles.weekButtonText, { color: primaryColor }]}>Semana atual</Text></TouchableOpacity>
      {weekStart ? <TouchableOpacity style={[styles.weekButton, { borderColor: primaryColor }]} onPress={() => void load(new Date(new Date(`${weekStart}T00:00:00`).getTime() - 7 * 86400000).toISOString().slice(0, 10))}><Text style={[styles.weekButtonText, { color: primaryColor }]}>Semana anterior</Text></TouchableOpacity> : null}
    </View>
    <View style={styles.summary}>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{totals.items ?? 0}</Text><Text style={styles.summaryLabel}>Registros</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{totals.validPeriods ?? 0}</Text><Text style={styles.summaryLabel}>Períodos válidos</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{totals.accumulatedMinutes ?? 0}</Text><Text style={styles.summaryLabel}>Minutos</Text></View>
    </View>
    <Text style={styles.section}>Detalhamento semanal</Text>
    {items.length === 0 ? <Text style={styles.empty}>Nenhum período registrado no escopo desta semana.</Text> : items.map((item: any) => <View key={item.id} style={styles.item}>
      <Text style={styles.itemTitle}>{item.broker_nome_guerra_snapshot || item.broker_name_snapshot}</Text>
      <Text style={styles.itemMeta}>{item.broker_name_snapshot} · {(item.details?.boothName || 'Plantão')}</Text>
      <View style={styles.grid}><Text style={styles.metric}>Válidos: {item.valid_periods}</Text><Text style={styles.metric}>Invalidados: {item.invalidated_periods}</Text><Text style={styles.metric}>Minutos: {item.accumulated_minutes}</Text><Text style={styles.metric}>Peso: {item.weighted_periods}</Text></View>
      <Text style={item.weekend_eligible ? styles.good : styles.muted}>{item.weekend_eligible ? 'Elegível para fim de semana' : 'Elegibilidade não atingida'}</Text>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f5f5f7' }, content: { padding: 24, paddingBottom: 60 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' }, muted: { color: '#636366', marginTop: 8 }, back: { marginTop: 36, marginBottom: 18 }, backText: { fontWeight: '700', fontSize: 16 }, title: { fontSize: 24, fontWeight: '800', color: '#1c1c1e' }, subtitle: { color: '#636366', marginTop: 8, marginBottom: 20 }, error: { color: '#b42318', marginBottom: 12 }, weekRow: { flexDirection: 'row', gap: 8, marginBottom: 20 }, weekButton: { backgroundColor: '#fff', borderWidth: 1, borderRadius: 8, padding: 12 }, weekButtonText: { fontWeight: '700' }, summary: { flexDirection: 'row', gap: 8, marginBottom: 24 }, summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e5ea' }, summaryNumber: { fontSize: 22, fontWeight: '800', color: '#1c1c1e' }, summaryLabel: { color: '#636366', fontSize: 12, marginTop: 4 }, section: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#1c1c1e' }, empty: { backgroundColor: '#fff', padding: 18, borderRadius: 10, color: '#636366' }, item: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5ea' }, itemTitle: { fontSize: 16, fontWeight: '800', color: '#1c1c1e' }, itemMeta: { color: '#636366', marginTop: 4, marginBottom: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '47%', color: '#3a3a3c', fontSize: 13 }, good: { color: '#248a3d', fontWeight: '800', marginTop: 12 } });
