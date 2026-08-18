import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenCode from '../components/ScreenCode';
import api from '../services/api';

type Booth = {
  id: string;
  name: string;
  address?: string;
  latitude?: string | number;
  longitude?: string | number;
  gps_radius?: number;
  min_brokers_required?: number;
  manager_id?: string | null;
  lifecycle_status?: 'draft' | 'published' | 'paused' | 'archived';
  wifis?: Array<{ ssid: string }>;
};
type RuleSet = {
  version: number;
  minimum_period_minutes: number;
  period_weight: number;
  saturday_required_periods: number;
  sunday_required_periods: number;
  opening_time: string | null;
  closing_time: string | null;
  checkin_tolerance_minutes: number;
  checkout_tolerance_minutes: number;
  ping_interval_minutes: number;
  ping_response_deadline_minutes: number;
  minimum_brokers_required: number;
  gps_radius_meters: number;
  weekend_enabled: boolean;
  minimum_monthly_periods: number;
};

const fields: Array<{ key: keyof RuleSet; label: string; integer?: boolean }> = [
  { key: 'minimum_period_minutes', label: 'Mínimo do período (minutos)', integer: true },
  { key: 'period_weight', label: 'Peso do período', integer: true },
  { key: 'saturday_required_periods', label: 'Períodos necessários no sábado', integer: true },
  { key: 'sunday_required_periods', label: 'Períodos necessários no domingo', integer: true },
  { key: 'opening_time', label: 'Abertura (HH:MM)' },
  { key: 'closing_time', label: 'Fechamento (HH:MM)' },
  { key: 'checkin_tolerance_minutes', label: 'Tolerância de entrada (minutos)', integer: true },
  { key: 'checkout_tolerance_minutes', label: 'Tolerância de saída (minutos)', integer: true },
  { key: 'ping_interval_minutes', label: 'Intervalo de confirmação (minutos)', integer: true },
  { key: 'ping_response_deadline_minutes', label: 'Prazo de resposta (minutos)', integer: true },
  { key: 'minimum_brokers_required', label: 'Corretores mínimos na cobertura', integer: true },
  { key: 'gps_radius_meters', label: 'Raio GPS permitido (metros)', integer: true },
  { key: 'minimum_monthly_periods', label: 'Meta mensal de períodos', integer: true },
];

export default function BoothRulesPanel({ onBack }: { onBack: () => void }) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState('');
  const [rules, setRules] = useState<RuleSet | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBooth, setSavingBooth] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    void loadBooths();
  }, []);

  useEffect(() => {
    if (selectedBoothId) {
      setSelectedBooth(booths.find((booth) => booth.id === selectedBoothId) || null);
      void loadRules(selectedBoothId);
    }
  }, [selectedBoothId]);

  async function loadBooths() {
    try {
      const response = await api.get('/booths');
      const items = Array.isArray(response.data) ? response.data : [];
      setBooths(items);
      if (items[0]) {
        setSelectedBoothId(items[0].id);
        setSelectedBooth(items[0]);
      }
    } catch (error) {
      Alert.alert('ABIATAR', 'Não foi possível carregar os plantões deste tenant.');
    } finally {
      setLoading(false);
    }
  }

  async function loadRules(boothId: string) {
    setLoading(true);
    try {
      const response = await api.get(`/booths/${boothId}/rules`);
      setRules(response.data);
      setReason('');
    } catch (error) {
      Alert.alert('ABIATAR', 'Não foi possível carregar as regras deste plantão.');
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: keyof RuleSet, value: string) {
    setRules((current) => current ? { ...current, [key]: value } : current);
  }

  function updateBoothField(key: keyof Booth, value: string) {
    setSelectedBooth((current) => current ? { ...current, [key]: value } : current);
  }

  async function saveBooth() {
    if (!selectedBooth || !selectedBoothId) return;
    setSavingBooth(true);
    try {
      const response = await api.patch(`/booths/${selectedBoothId}`, {
        name: selectedBooth.name,
        address: selectedBooth.address,
        latitude: Number(selectedBooth.latitude),
        longitude: Number(selectedBooth.longitude),
        gpsRadius: Number(selectedBooth.gps_radius),
        minimumBrokersRequired: Number(selectedBooth.min_brokers_required),
        managerId: selectedBooth.manager_id || null,
        wifis: (selectedBooth.wifis || []).map((wifi) => wifi.ssid).filter(Boolean),
        reason: reason.trim() || 'Atualização do cadastro do plantão pela Diretoria',
      });
      setSelectedBooth(response.data);
      setBooths((current) => current.map((booth) => booth.id === response.data.id ? response.data : booth));
      Alert.alert('ABIATAR', 'Cadastro-base do plantão atualizado e auditado.');
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível salvar o cadastro do plantão.');
    } finally {
      setSavingBooth(false);
    }
  }

  async function changeLifecycle(action: 'publish' | 'pause' | 'archive') {
    if (!selectedBoothId) return;
    try {
      const response = await api.post(`/booths/${selectedBoothId}/${action}`);
      setSelectedBooth(response.data);
      setBooths((current) => current.map((booth) => booth.id === response.data.id ? response.data : booth));
      Alert.alert('ABIATAR', action === 'publish' ? 'Plantão publicado para a operação.' : `Plantão ${action === 'pause' ? 'pausado' : 'arquivado'}.`);
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível alterar o estado do plantão.');
    }
  }

  async function saveRules() {
    if (!rules || !selectedBoothId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        minimumPeriodMinutes: Number(rules.minimum_period_minutes),
        periodWeight: Number(rules.period_weight),
        saturdayRequiredPeriods: Number(rules.saturday_required_periods),
        sundayRequiredPeriods: Number(rules.sunday_required_periods),
        openingTime: rules.opening_time || null,
        closingTime: rules.closing_time || null,
        checkinToleranceMinutes: Number(rules.checkin_tolerance_minutes),
        checkoutToleranceMinutes: Number(rules.checkout_tolerance_minutes),
        pingIntervalMinutes: Number(rules.ping_interval_minutes),
        pingResponseDeadlineMinutes: Number(rules.ping_response_deadline_minutes),
        minimumBrokersRequired: Number(rules.minimum_brokers_required),
        gpsRadiusMeters: Number(rules.gps_radius_meters),
        weekendEnabled: rules.weekend_enabled,
        minimumMonthlyPeriods: Number(rules.minimum_monthly_periods),
        reason: reason.trim() || 'Ajuste operacional da Diretoria',
      };
      const response = await api.patch(`/booths/${selectedBoothId}/rules`, payload);
      setRules(response.data);
      setReason('');
      Alert.alert('ABIATAR', 'Regras do plantão salvas. Nova versão registrada na auditoria.');
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível salvar as regras.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !rules) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1c1c1e" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScreenCode code="DR-02" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Voltar</Text></TouchableOpacity>
        <Text style={styles.title}>Regras por Plantão</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Text style={styles.subtitle}>Configuração White Label do tenant</Text>
        <Text style={styles.description}>Cada plantão possui regras próprias. Alterações geram uma nova versão e não modificam presenças já iniciadas.</Text>
        <Text style={styles.label}>Selecionar plantão</Text>
        <View style={styles.boothRow}>
          {booths.map((booth) => (
              <TouchableOpacity key={booth.id} style={[styles.boothButton, selectedBoothId === booth.id && styles.boothButtonActive]} onPress={() => setSelectedBoothId(booth.id)}>
              <Text style={[styles.boothText, selectedBoothId === booth.id && styles.boothTextActive]}>{booth.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedBooth && (
          <>
            <Text style={styles.sectionTitle}>Cadastro-base do plantão</Text>
            <Text style={styles.lifecycle}>Estado: {selectedBooth.lifecycle_status || 'draft'}</Text>
            {(['name', 'address', 'latitude', 'longitude', 'gps_radius', 'min_brokers_required', 'manager_id'] as Array<keyof Booth>).map((key) => (
              <View key={String(key)} style={styles.field}>
                <Text style={styles.label}>{({ name: 'Nome', address: 'Endereço', latitude: 'Latitude', longitude: 'Longitude', gps_radius: 'Raio GPS legado', min_brokers_required: 'Cobertura mínima legada', manager_id: 'ID do gerente responsável' } as Record<string, string>)[String(key)]}</Text>
                <TextInput value={String(selectedBooth[key] ?? '')} onChangeText={(value) => updateBoothField(key, value)} style={styles.input} />
              </View>
            ))}
            <Text style={styles.label}>Redes Wi-Fi autorizadas (uma por linha)</Text>
            <TextInput value={(selectedBooth.wifis || []).map((wifi) => wifi.ssid).join('\\n')} onChangeText={(value) => setSelectedBooth({ ...selectedBooth, wifis: value.split('\\n').map((ssid) => ({ ssid: ssid.trim() })).filter((wifi) => wifi.ssid) })} style={[styles.input, styles.reason]} multiline />
            <TouchableOpacity style={styles.saveSecondary} onPress={saveBooth} disabled={savingBooth}>
              {savingBooth ? <ActivityIndicator color="#1c1c1e" /> : <Text style={styles.saveSecondaryText}>Salvar cadastro-base</Text>}
            </TouchableOpacity>
            <View style={styles.lifecycleRow}>
              <TouchableOpacity style={styles.lifecycleButton} onPress={() => changeLifecycle('publish')}><Text style={styles.lifecycleButtonText}>Publicar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.lifecycleButton} onPress={() => changeLifecycle('pause')}><Text style={styles.lifecycleButtonText}>Pausar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.lifecycleButton} onPress={() => changeLifecycle('archive')}><Text style={styles.lifecycleButtonText}>Arquivar</Text></TouchableOpacity>
            </View>
            {rules && <>
            <Text style={styles.sectionTitle}>Regras operacionais versionadas</Text>
            <Text style={styles.version}>Versão ativa: {rules.version}</Text>
            {fields.map((field) => (
              <View key={String(field.key)} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  value={String(rules[field.key] ?? '')}
                  onChangeText={(value) => updateField(field.key, value)}
                  keyboardType={field.integer ? 'numeric' : 'default'}
                  style={styles.input}
                  placeholder={field.label}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.toggle} onPress={() => setRules({ ...rules, weekend_enabled: !rules.weekend_enabled })}>
              <Text style={styles.toggleText}>Fim de semana: {rules.weekend_enabled ? 'ATIVO' : 'INATIVO'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Motivo da alteração</Text>
            <TextInput value={reason} onChangeText={setReason} style={[styles.input, styles.reason]} multiline placeholder="Informe o motivo para a auditoria" />
            <TouchableOpacity style={styles.save} onPress={saveRules} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Salvar nova versão</Text>}
            </TouchableOpacity>
            </>}
          </>
        )}
        {!booths.length && <Text style={styles.empty}>Nenhum plantão cadastrado neste tenant.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 18, backgroundColor: '#1c1c1e' },
  back: { color: '#fff', fontSize: 16, marginBottom: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 6 },
  description: { color: '#666', lineHeight: 20, marginBottom: 18 },
  label: { color: '#333', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  boothRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  boothButton: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  boothButtonActive: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  boothText: { color: '#333' },
  boothTextActive: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#1c1c1e', fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  lifecycle: { color: '#0f766e', fontWeight: '800', marginBottom: 12, textTransform: 'uppercase' },
  version: { color: '#666', marginBottom: 12 },
  field: { marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  reason: { minHeight: 80, textAlignVertical: 'top' },
  toggle: { padding: 14, borderRadius: 8, backgroundColor: '#ececef', marginBottom: 16 },
  toggleText: { color: '#1c1c1e', fontWeight: '700' },
  saveSecondary: { backgroundColor: '#e5e7eb', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 8 },
  saveSecondaryText: { color: '#1c1c1e', fontWeight: '800', fontSize: 15 },
  lifecycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  lifecycleButton: { backgroundColor: '#dbeafe', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  lifecycleButtonText: { color: '#1e3a8a', fontWeight: '800' },
  save: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 8 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { color: '#666', paddingVertical: 20 },
});
