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
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Booth = {
  id: string;
  name: string;
  address?: string;
  latitude?: string | number;
  longitude?: string | number;
  gps_radius?: number;
  min_brokers_required?: number;
  base_gps_radius?: number;
  effective_gps_radius?: number;
  base_min_brokers_required?: number;
  effective_min_brokers_required?: number;
  manager_id?: string | null;
  lifecycle_status?: 'draft' | 'published' | 'paused' | 'archived';
  wifis?: Array<{ ssid: string }>;
};

type RuleSet = {
  version: number;
  roleta_1_time: string | null;
  roleta_2_time: string | null;
  roleta_3_time: string | null;
  roleta_weekend_time: string | null;
  checkin_early_minutes: number;
  pos_barra_minutes: number;
  minimum_period_minutes: number;
  period_weight: number;
  minimum_monthly_periods: number;
  saturday_required_periods: number;
  sunday_required_periods: number;
  weekend_enabled: boolean;
  gps_radius_meters: number;
  ping_interval_minutes: number;
  ping_response_deadline_minutes: number;
  minimum_brokers_required: number;
  opening_time?: string | null;
  closing_time?: string | null;
  checkin_tolerance_minutes?: number;
  checkout_tolerance_minutes?: number;
};

type Holiday = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  roleta_time: string;
  scope: 'all' | 'specific';
  boothId: string | null;
  boothName: string;
  createdAt: string;
};

type SpecialSchedule = {
  id: string;
  booth_id: string;
  scope: 'recurring' | 'one_off';
  day_of_week: number | null;
  specific_date: string | null;
  description: string;
  roleta_time: string;
  created_at: string;
};

export default function BoothRulesPanel({ onBack, primaryColor = '#e53924' }: { onBack: () => void; primaryColor?: string }) {
  const { tenant } = useAuth();
  // Aba Ativa: 'booths' (Regras e Plantões) ou 'holidays' (Feriados - Roleta Única)
  const [activeTab, setActiveTab] = useState<'booths' | 'holidays'>('booths');

  // Estado dos Plantões e Regras
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState('');
  const [rules, setRules] = useState<RuleSet | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBooth, setSavingBooth] = useState(false);
  const [reason, setReason] = useState('');

  const [roleta3Enabled, setRoleta3Enabled] = useState(false);

  // Estado dos Horários Especiais do Plantão (Soberanos)
  const [specialSchedules, setSpecialSchedules] = useState<SpecialSchedule[]>([]);
  const [loadingSpecialSchedules, setLoadingSpecialSchedules] = useState(false);
  const [specialScope, setSpecialScope] = useState<'recurring' | 'one_off'>('one_off');
  const [specialDayOfWeek, setSpecialDayOfWeek] = useState<number>(0); // 0 = Domingo
  const [specialRoletaTime, setSpecialRoletaTime] = useState('12:00');
  const [specialDescription, setSpecialDescription] = useState('');
  const [creatingSpecial, setCreatingSpecial] = useState(false);

  // Estado dos Feriados
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayDate, setHolidayDate] = useState(''); // DD/MM/AAAA
  const [holidayName, setHolidayName] = useState('');
  const [holidayRoletaTime, setHolidayRoletaTime] = useState('09:00');
  const [holidayScope, setHolidayScope] = useState<'all' | 'specific'>('all');
  const [selectedHolidayBoothIds, setSelectedHolidayBoothIds] = useState<string[]>([]);
  const [creatingHoliday, setCreatingHoliday] = useState(false);

  useEffect(() => {
    void loadBooths();
    void loadHolidays();
  }, []);

  useEffect(() => {
    if (selectedBoothId) {
      setSelectedBooth(booths.find((booth) => booth.id === selectedBoothId) || null);
      void loadRules(selectedBoothId);
      void loadSpecialSchedules(selectedBoothId);
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
      const r3 = response.data.roleta_3_time;
      const isR3On = Boolean(r3 && String(r3).trim() !== '');
      setRoleta3Enabled(isR3On);
      setRules({
        ...response.data,
        roleta_1_time: response.data.roleta_1_time || '09:00',
        roleta_2_time: response.data.roleta_2_time || '14:00',
        roleta_3_time: isR3On ? r3 : '',
        roleta_weekend_time: response.data.roleta_weekend_time || '09:00',
        checkin_early_minutes: response.data.checkin_early_minutes ?? 30,
        pos_barra_minutes: response.data.pos_barra_minutes ?? 30,
      });
      setReason('');
    } catch (error) {
      Alert.alert('ABIATAR', 'Não foi possível carregar as regras deste plantão.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSpecialSchedules(boothId: string) {
    if (!boothId) return;
    setLoadingSpecialSchedules(true);
    try {
      const response = await api.get(`/booths/${boothId}/special-schedules`);
      setSpecialSchedules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar horários especiais:', error);
    } finally {
      setLoadingSpecialSchedules(false);
    }
  }

  async function loadHolidays() {
    setLoadingHolidays(true);
    try {
      const response = await api.get('/booths/holidays');
      setHolidays(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar feriados:', error);
    } finally {
      setLoadingHolidays(false);
    }
  }

  function updateField(key: keyof RuleSet, value: string) {
    setRules((current) => current ? { ...current, [key]: value } : current);
  }

  function updateBoothField(key: keyof Booth, value: string) {
    setSelectedBooth((current) => current ? { ...current, [key]: value } : current);
  }

  function startNewBooth() {
    const fresh: Booth = {
      id: '',
      name: 'Novo Plantão de Vendas',
      address: '',
      latitude: '',
      longitude: '',
      gps_radius: 100,
      min_brokers_required: 2,
      lifecycle_status: 'draft',
      wifis: [],
    };
    setSelectedBooth(fresh);
    setSelectedBoothId('');
    setRules(null);
  }

  async function saveBooth() {
    if (!selectedBooth) return;
    setSavingBooth(true);
    try {
      const payload = {
        name: selectedBooth.name,
        address: selectedBooth.address,
        latitude: Number(selectedBooth.latitude),
        longitude: Number(selectedBooth.longitude),
        gpsRadius: Number(selectedBooth.gps_radius),
        minimumBrokersRequired: Number(selectedBooth.min_brokers_required),
        managerId: selectedBooth.manager_id || null,
        wifis: (selectedBooth.wifis || []).map((wifi) => wifi.ssid).filter(Boolean),
        reason: reason.trim() || 'Atualização do cadastro do plantão pela Diretoria',
      };
      const response = selectedBoothId
        ? await api.patch(`/booths/${selectedBoothId}`, payload)
        : await api.post('/booths', {
            name: selectedBooth.name,
            address: selectedBooth.address,
            latitude: Number(selectedBooth.latitude),
            longitude: Number(selectedBooth.longitude),
            gps_radius: Number(selectedBooth.gps_radius),
            min_brokers_required: Number(selectedBooth.min_brokers_required),
            managerId: selectedBooth.manager_id || null,
            wifis: (selectedBooth.wifis || []).map((wifi) => wifi.ssid).filter(Boolean),
          });
      setSelectedBooth(response.data);
      if (!selectedBoothId) setSelectedBoothId(response.data.id);
      setBooths((current) => current.some((booth) => booth.id === response.data.id)
        ? current.map((booth) => booth.id === response.data.id ? response.data : booth)
        : [...current, response.data]);
      Alert.alert('ABIATAR', selectedBoothId ? 'Cadastro-base do plantão atualizado e auditado.' : 'Plantão criado como rascunho. Configure as regras e publique quando estiver validado.');
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
        roleta1Time: rules.roleta_1_time || null,
        roleta2Time: rules.roleta_2_time || null,
        roleta3Time: roleta3Enabled && rules.roleta_3_time && rules.roleta_3_time.trim() !== '' ? rules.roleta_3_time.trim() : null,
        roletaWeekendTime: rules.roleta_weekend_time || null,
        checkinEarlyMinutes: Number(rules.checkin_early_minutes ?? 30),
        posBarraMinutes: Number(rules.pos_barra_minutes ?? 30),
        minimumPeriodMinutes: Number(rules.minimum_period_minutes ?? 120),
        minimumMonthlyPeriods: Number(rules.minimum_monthly_periods ?? 20),
        saturdayRequiredPeriods: Number(rules.saturday_required_periods ?? 5),
        sundayRequiredPeriods: Number(rules.sunday_required_periods ?? 6),
        weekendEnabled: rules.weekend_enabled ?? true,
        gpsRadiusMeters: Number(rules.gps_radius_meters ?? 100),
        pingIntervalMinutes: Number(rules.ping_interval_minutes ?? 30),
        pingResponseDeadlineMinutes: Number(rules.ping_response_deadline_minutes ?? 5),
        minimumBrokersRequired: Number(rules.minimum_brokers_required ?? 2),
        periodWeight: Number(rules.period_weight ?? 1),
        reason: reason.trim() || 'Atualização das regras da Roleta pela Diretoria',
      };
      const response = await api.patch(`/booths/${selectedBoothId}/rules`, payload);
      setRules(response.data);
      setReason('');
      Alert.alert('ABIATAR', 'Regras da Roleta salvas com sucesso. Nova versão registrada na auditoria.');
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível salvar as regras.');
    } finally {
      setSaving(false);
    }
  }

  const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  async function handleCreateSpecialSchedule() {
    if (!selectedBoothId) {
      Alert.alert('ABIATAR', 'Selecione um plantão para cadastrar o horário especial.');
      return;
    }
    if (!specialRoletaTime.trim()) {
      Alert.alert('ABIATAR', 'Informe o horário da Roleta Especial (ex: 12:00).');
      return;
    }

    setCreatingSpecial(true);
    try {
      await api.post(`/booths/${selectedBoothId}/special-schedules`, {
        scope: specialScope,
        dayOfWeek: specialDayOfWeek,
        roletaTime: specialRoletaTime.trim(),
        description: specialDescription.trim() || `Horário Especial (${DAY_NAMES[specialDayOfWeek]})`,
      });

      Alert.alert('ABIATAR', 'Horário Especial cadastrado com sucesso! Este horário tem prioridade soberana sobre o horário padrão.');
      setSpecialDescription('');
      setSpecialRoletaTime('12:00');
      await loadSpecialSchedules(selectedBoothId);
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível cadastrar o horário especial.');
    } finally {
      setCreatingSpecial(false);
    }
  }

  async function handleDeleteSpecialSchedule(schedule: SpecialSchedule) {
    Alert.alert(
      'Remover Horário Especial',
      `Deseja remover o horário especial '${schedule.description}' (${schedule.roleta_time})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/booths/special-schedules/${schedule.id}`);
              Alert.alert('ABIATAR', 'Horário especial removido com sucesso.');
              if (selectedBoothId) await loadSpecialSchedules(selectedBoothId);
            } catch (error: any) {
              Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível remover.');
            }
          },
        },
      ]
    );
  }

  // Helper de Análise de Data e Dia da Semana
  function parseDateInfo(raw: string): { label: string; isPast: boolean; isValid: boolean; isoDate: string } {
    const trimmed = raw.trim();
    let day = 0, month = 0, year = 0;

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const p = trimmed.split('/');
      day = Number(p[0]);
      month = Number(p[1]);
      year = Number(p[2]);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const p = trimmed.split('-');
      year = Number(p[0]);
      month = Number(p[1]);
      day = Number(p[2]);
    } else {
      return { label: '', isPast: false, isValid: false, isoDate: '' };
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2024 || year > 2099) {
      return { label: '', isPast: false, isValid: false, isoDate: '' };
    }

    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return { label: '', isPast: false, isValid: false, isoDate: '' };
    }

    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayName = days[d.getDay()];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = d.getTime() < today.getTime();
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return { label: dayName, isPast, isValid: true, isoDate };
  }

  const dateInfo = parseDateInfo(holidayDate);

  // Aplica máscara automática de data DD/MM/AAAA enquanto o usuário digita
  function handleDateChange(text: string) {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setHolidayDate(formatted);
  }

  function toggleBoothHolidaySelection(id: string) {
    setSelectedHolidayBoothIds((prev) =>
      prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]
    );
  }

  async function handleCreateHoliday() {
    if (!holidayDate.trim() || !holidayName.trim()) {
      Alert.alert('ABIATAR', 'Por favor, preencha a data e o nome do feriado.');
      return;
    }

    if (!dateInfo.isValid) {
      Alert.alert('ABIATAR', 'Por favor, informe uma data válida no formato DD/MM/AAAA.');
      return;
    }

    if (dateInfo.isPast) {
      Alert.alert('ABIATAR', 'Apenas datas de hoje ou posteriores podem ser cadastradas como feriado.');
      return;
    }

    if (holidayScope === 'specific' && selectedHolidayBoothIds.length === 0) {
      Alert.alert('ABIATAR', 'Selecione ao menos um plantão para aplicar o feriado.');
      return;
    }

    setCreatingHoliday(true);
    try {
      await api.post('/booths/holidays', {
        date: dateInfo.isoDate,
        name: holidayName.trim(),
        roletaTime: holidayRoletaTime || '09:00',
        scope: holidayScope,
        boothIds: holidayScope === 'specific' ? selectedHolidayBoothIds : undefined,
      });

      Alert.alert('ABIATAR', `Feriado '${holidayName}' cadastrado com sucesso com Roleta Única às ${holidayRoletaTime || '09:00'}!`);
      setHolidayDate('');
      setHolidayName('');
      setHolidayRoletaTime('09:00');
      setHolidayScope('all');
      setSelectedHolidayBoothIds([]);
      await loadHolidays();
    } catch (error: any) {
      Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível cadastrar o feriado.');
    } finally {
      setCreatingHoliday(false);
    }
  }

  async function handleDeleteHoliday(holiday: Holiday) {
    Alert.alert(
      'Remover Feriado',
      `Deseja remover o feriado '${holiday.name}' (${formatDateDisplay(holiday.date)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/booths/holidays/${holiday.id}`);
              Alert.alert('ABIATAR', 'Feriado removido com sucesso.');
              await loadHolidays();
            } catch (error: any) {
              Alert.alert('ABIATAR', error?.response?.data?.message || 'Não foi possível remover o feriado.');
            }
          },
        },
      ]
    );
  }

  function formatDateDisplay(isoDate: string): string {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  function getHolidayDayOfWeek(isoDate: string): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[date.getDay()] || '';
  }

  if (loading && !rules) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1c1c1e" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Voltar ao Painel</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 }}>{tenant?.name || 'ABIATAR'}</Text>
        <Text style={styles.title}>Administrar Plantões & Roletas</Text>
        <Text style={styles.headerSubtitle}>Grade de horários, regras operacionais e feriados</Text>
      </View>

      {/* SELETOR DE ABAS PRINCIPAIS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'booths' && styles.tabButtonActive]}
          onPress={() => setActiveTab('booths')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'booths' && styles.tabButtonTextActive]}>
            🏢 Plantões & Horários
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'holidays' && styles.tabButtonActive]}
          onPress={() => setActiveTab('holidays')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'holidays' && styles.tabButtonTextActive]}>
            📅 Feriados (Roleta Única)
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        {/* ========================================================================= */}
        {/* ABA 1: PLANTÕES & REGRAS OPERACIONAIS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'booths' && (
          <>
            <Text style={styles.subtitle}>Configuração Operacional dos Plantões</Text>
            <Text style={styles.description}>Configure os horários de roleta, antecedência de check-in, janelas de pós-barra e metas de fim de semana por estande.</Text>
            
            <View style={styles.boothToolbar}>
              <Text style={styles.label}>Selecionar plantão de vendas:</Text>
              <TouchableOpacity style={styles.newBoothButton} onPress={startNewBooth}><Text style={styles.newBoothText}>+ Novo plantão</Text></TouchableOpacity>
            </View>

            <View style={styles.boothRow}>
              {booths.map((booth) => (
                <TouchableOpacity key={booth.id} style={[styles.boothButton, selectedBoothId === booth.id && styles.boothButtonActive]} onPress={() => setSelectedBoothId(booth.id)}>
                  <Text style={[styles.boothText, selectedBoothId === booth.id && styles.boothTextActive]}>{booth.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedBooth && (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>1. Cadastro-Base do Plantão</Text>
                  <Text style={styles.lifecycle}>Status de Operação: {selectedBooth.lifecycle_status || 'draft'}</Text>
                  
                  <View style={styles.field}>
                    <Text style={styles.label}>Nome do Empreendimento / Plantão</Text>
                    <TextInput value={String(selectedBooth.name || '')} onChangeText={(v) => updateBoothField('name', v)} style={styles.input} />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Endereço do Plantão</Text>
                    <TextInput value={String(selectedBooth.address || '')} onChangeText={(v) => updateBoothField('address', v)} style={styles.input} />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Latitude</Text>
                      <TextInput value={String(selectedBooth.latitude || '')} onChangeText={(v) => updateBoothField('latitude', v)} style={styles.input} />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Longitude</Text>
                      <TextInput value={String(selectedBooth.longitude || '')} onChangeText={(v) => updateBoothField('longitude', v)} style={styles.input} />
                    </View>
                  </View>

                  <Text style={styles.label}>Redes Wi-Fi Autorizadas (uma por linha)</Text>
                  <TextInput value={(selectedBooth.wifis || []).map((wifi) => wifi.ssid).join('\n')} onChangeText={(value) => setSelectedBooth({ ...selectedBooth, wifis: value.split('\n').map((ssid) => ({ ssid: ssid.trim() })).filter((wifi) => wifi.ssid) })} style={[styles.input, styles.reason]} multiline placeholder="Ex: Wi-Fi_Plantao_01" />

                  <TouchableOpacity style={styles.saveSecondary} onPress={saveBooth} disabled={savingBooth}>
                    {savingBooth ? <ActivityIndicator color="#1c1c1e" /> : <Text style={styles.saveSecondaryText}>{selectedBoothId ? 'Salvar Dados do Plantão' : 'Criar Plantão como Rascunho'}</Text>}
                  </TouchableOpacity>

                  <View style={styles.lifecycleRow}>
                    <TouchableOpacity style={[styles.lifecycleButton, { backgroundColor: '#dcfce7' }]} onPress={() => changeLifecycle('publish')}><Text style={[styles.lifecycleButtonText, { color: '#15803d' }]}>Publicar Plantão</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.lifecycleButton, { backgroundColor: '#fef9c3' }]} onPress={() => changeLifecycle('pause')}><Text style={[styles.lifecycleButtonText, { color: '#a16207' }]}>Pausar</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.lifecycleButton, { backgroundColor: '#fee2e2' }]} onPress={() => changeLifecycle('archive')}><Text style={[styles.lifecycleButtonText, { color: '#b91c1c' }]}>Arquivar</Text></TouchableOpacity>
                  </View>
                </View>

                {rules && (
                  <>
                    <View style={styles.card}>
                    <Text style={styles.sectionTitle}>2. Grade de Horários das Roletas</Text>
                    <Text style={styles.version}>Versão das Regras: v{rules.version}</Text>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Horário Roleta 1 (Manhã)</Text>
                        <TextInput value={String(rules.roleta_1_time || '09:00')} onChangeText={(v) => updateField('roleta_1_time', v)} style={styles.input} placeholder="09:00" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Horário Roleta 2 (Tarde)</Text>
                        <TextInput value={String(rules.roleta_2_time || '14:00')} onChangeText={(v) => updateField('roleta_2_time', v)} style={styles.input} placeholder="14:00" />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.label}>3º Período (Noite)</Text>
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: roleta3Enabled ? '#dcfce7' : '#f5d2cd',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: roleta3Enabled ? '#86efac' : '#f0b5ab',
                            }}
                            onPress={() => {
                              const next = !roleta3Enabled;
                              setRoleta3Enabled(next);
                              if (!next) {
                                updateField('roleta_3_time', '');
                              } else if (!rules.roleta_3_time) {
                                updateField('roleta_3_time', '18:00');
                              }
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: roleta3Enabled ? '#15803d' : '#c13a28' }}>
                              {roleta3Enabled ? '🟢 HABILITADO' : '⚪ DESABILITADO'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          value={String(rules.roleta_3_time || '')}
                          onChangeText={(v) => updateField('roleta_3_time', v)}
                          editable={roleta3Enabled}
                          style={[
                            styles.input,
                            !roleta3Enabled && { backgroundColor: '#f5d2cd', color: '#c13a28', borderColor: '#f0b5ab' },
                          ]}
                          placeholder={roleta3Enabled ? 'Ex: 18:00 ou 19:00' : 'Desabilitado (Sem 3ª roleta)'}
                        />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Roleta Padrão Fim de Semana</Text>
                        <TextInput value={String(rules.roleta_weekend_time || '09:00')} onChangeText={(v) => updateField('roleta_weekend_time', v)} style={styles.input} placeholder="09:00" />
                      </View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>3. Janelas de Entrada e Pós-Barra</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Check-in Liberado (Minutos antes)</Text>
                        <TextInput value={String(rules.checkin_early_minutes ?? 30)} onChangeText={(v) => updateField('checkin_early_minutes', v)} keyboardType="numeric" style={styles.input} placeholder="30" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Tolerância Pós-Barra (Minutos após)</Text>
                        <TextInput value={String(rules.pos_barra_minutes ?? 30)} onChangeText={(v) => updateField('pos_barra_minutes', v)} keyboardType="numeric" style={styles.input} placeholder="30" />
                      </View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>4. Validação e Cômputo da Roleta</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Tempo Mínimo para Validar (Minutos)</Text>
                        <TextInput value={String(rules.minimum_period_minutes ?? 120)} onChangeText={(v) => updateField('minimum_period_minutes', v)} keyboardType="numeric" style={styles.input} placeholder="120" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Meta Mensal de Roletas</Text>
                        <TextInput value={String(rules.minimum_monthly_periods ?? 20)} onChangeText={(v) => updateField('minimum_monthly_periods', v)} keyboardType="numeric" style={styles.input} placeholder="20" />
                      </View>
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>5. Elegibilidade para Fim de Semana</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Roletas para Sábado (Seg a Sex)</Text>
                        <TextInput value={String(rules.saturday_required_periods ?? 5)} onChangeText={(v) => updateField('saturday_required_periods', v)} keyboardType="numeric" style={styles.input} placeholder="5" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Roletas para Domingo (Seg a Sex)</Text>
                        <TextInput value={String(rules.sunday_required_periods ?? 6)} onChangeText={(v) => updateField('sunday_required_periods', v)} keyboardType="numeric" style={styles.input} placeholder="6" />
                      </View>
                    </View>

                    <TouchableOpacity style={styles.toggle} onPress={() => setRules({ ...rules, weekend_enabled: !rules.weekend_enabled })}>
                      <Text style={styles.toggleText}>Habilitar Roletas em Fins de Semana: {rules.weekend_enabled ? 'SIM (Ativo)' : 'NÃO (Bloqueado)'}</Text>
                    </TouchableOpacity>

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>6. Parâmetros de Presença e Segurança</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Raio GPS Permitido (Metros)</Text>
                        <TextInput value={String(rules.gps_radius_meters ?? 100)} onChangeText={(v) => updateField('gps_radius_meters', v)} keyboardType="numeric" style={styles.input} placeholder="100" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Mínimo de Corretores no Plantão</Text>
                        <TextInput value={String(rules.minimum_brokers_required ?? 2)} onChangeText={(v) => updateField('minimum_brokers_required', v)} keyboardType="numeric" style={styles.input} placeholder="2" />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Intervalo de Confirmação (Minutos)</Text>
                        <TextInput value={String(rules.ping_interval_minutes ?? 30)} onChangeText={(v) => updateField('ping_interval_minutes', v)} keyboardType="numeric" style={styles.input} placeholder="30" />
                      </View>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Prazo de Resposta (Minutos)</Text>
                        <TextInput value={String(rules.ping_response_deadline_minutes ?? 5)} onChangeText={(v) => updateField('ping_response_deadline_minutes', v)} keyboardType="numeric" style={styles.input} placeholder="5" />
                      </View>
                    </View>

                    <Text style={[styles.label, { marginTop: 16 }]}>Motivo da Alteração das Regras (Auditoria)</Text>
                    <TextInput value={reason} onChangeText={setReason} style={[styles.input, styles.reason]} multiline placeholder="Informe o motivo para a trilha de auditoria" />

                    <TouchableOpacity style={styles.save} onPress={saveRules} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Salvar Regras da Roleta (Nova Versão)</Text>}
                    </TouchableOpacity>
                  </View>

                  {/* ========================================================================= */}
                  {/* SEÇÃO 7: HORÁRIOS ESPECIAIS DO PLANTÃO (SOBERANOS)                       */}
                  {/* ========================================================================= */}
                  <View style={[styles.card, { marginTop: 16 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.sectionTitle}>7. Horários Especiais do Plantão (Soberanos)</Text>
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fde68a' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#b45309' }}>👑 SOBERANIA MÁXIMA</Text>
                      </View>
                    </View>
                    <Text style={[styles.description, { marginBottom: 12 }]}>
                      Configure horários diferenciados de abertura e <Text style={{ fontWeight: '700' }}>Roleta Única</Text> exclusivos para este plantão (ex: shoppings aos domingos, eventos ou feriados). O horário especial tem prioridade soberana e substitui a grade padrão.
                    </Text>

                    {/* SELEÇÃO DO DIA DA SEMANA */}
                    <Text style={[styles.label, { marginBottom: 6 }]}>Dia da Semana:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {DAY_NAMES.map((name, idx) => (
                          <TouchableOpacity
                            key={name}
                            style={[
                              styles.dayChip,
                              specialDayOfWeek === idx && styles.dayChipActive,
                            ]}
                            onPress={() => setSpecialDayOfWeek(idx)}
                          >
                            <Text
                              style={[
                                styles.dayChipText,
                                specialDayOfWeek === idx && styles.dayChipTextActive,
                              ]}
                            >
                              {name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* FREQUÊNCIA / ESCOPO */}
                    <Text style={[styles.label, { marginBottom: 6 }]}>Frequência de Aplicação:</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[styles.scopeOption, specialScope === 'one_off' && styles.scopeOptionActive, { flex: 1 }]}
                        onPress={() => setSpecialScope('one_off')}
                      >
                        <Text style={[styles.scopeText, specialScope === 'one_off' && styles.scopeTextActive]}>
                          📅 Somente o Próximo ({DAY_NAMES[specialDayOfWeek]})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.scopeOption, specialScope === 'recurring' && styles.scopeOptionActive, { flex: 1 }]}
                        onPress={() => setSpecialScope('recurring')}
                      >
                        <Text style={[styles.scopeText, specialScope === 'recurring' && styles.scopeTextActive]}>
                          🔄 Todos os ({DAY_NAMES[specialDayOfWeek]}s)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* HORÁRIO DA ROLETA E DESCRIÇÃO */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.label}>Horário da Roleta Única *</Text>
                        <TextInput
                          value={specialRoletaTime}
                          onChangeText={setSpecialRoletaTime}
                          style={styles.input}
                          placeholder="12:00"
                        />
                      </View>
                      <View style={[styles.field, { flex: 2 }]}>
                        <Text style={styles.label}>Motivo / Descrição</Text>
                        <TextInput
                          value={specialDescription}
                          onChangeText={setSpecialDescription}
                          style={styles.input}
                          placeholder="Ex: Abertura Shopping às 12h"
                        />
                      </View>
                    </View>

                    {/* BOTÃO ADICIONAR HORÁRIO ESPECIAL */}
                    <TouchableOpacity
                      style={[styles.save, { backgroundColor: '#1c1c1e', marginTop: 8 }]}
                      onPress={handleCreateSpecialSchedule}
                      disabled={creatingSpecial}
                    >
                      {creatingSpecial ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveText}>+ Adicionar Horário Especial Soberano</Text>
                      )}
                    </TouchableOpacity>

                    {/* LISTA DE HORÁRIOS ESPECIAIS ATIVOS */}
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 8 }]}>
                        Horários Especiais Cadastrados para {selectedBooth?.name || 'este plantão'} ({specialSchedules.length})
                      </Text>

                      {loadingSpecialSchedules ? (
                        <ActivityIndicator size="small" color="#1c1c1e" style={{ marginVertical: 10 }} />
                      ) : specialSchedules.length === 0 ? (
                        <View style={{ backgroundColor: '#fdecea', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#f0b5ab' }}>
                          <Text style={{ fontSize: 13, color: '#c13a28', textAlign: 'center' }}>
                            Nenhum horário especial configurado para este estande. O plantão seguirá a grade regular padrão.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: 8 }}>
                          {specialSchedules.map((schedule) => (
                            <View
                              key={schedule.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#fdecea',
                                padding: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: '#f0b5ab',
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#b45309' }}>👑 SOBERANO</Text>
                                  </View>
                                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827' }}>
                                    🎰 Roleta às {schedule.roleta_time}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#c13a28' }}>
                                  {schedule.description}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#c13a28', marginTop: 2 }}>
                                  {schedule.scope === 'one_off'
                                    ? `📅 Pontual: ${schedule.specific_date ? formatDateDisplay(schedule.specific_date) : 'Próxima data'} (${schedule.day_of_week !== null ? DAY_NAMES[schedule.day_of_week] : ''})`
                                    : `🔄 Recorrente: Todos os ${schedule.day_of_week !== null ? DAY_NAMES[schedule.day_of_week] : ''}s`}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.deleteHolidayButton}
                                onPress={() => handleDeleteSpecialSchedule(schedule)}
                              >
                                <Text style={styles.deleteHolidayButtonText}>🗑️</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </>
              )}
              </>
            )}
            {!booths.length && <Text style={styles.empty}>Nenhum plantão cadastrado neste tenant.</Text>}
          </>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: GESTÃO DE FERIADOS (ROLETA ÚNICA)                                  */}
        {/* ========================================================================= */}
        {activeTab === 'holidays' && (
          <>
            <Text style={styles.subtitle}>Gestão de Feriados (Roleta Única)</Text>
            <Text style={styles.description}>
              Cadastre feriados nacionais, estaduais, municipais ou pontos facultativos. Nesses dias, os plantões configurados operarão com <Text style={{ fontWeight: 'bold' }}>Roleta Única</Text> no horário determinado.
            </Text>

            {/* FORMULÁRIO DE CADASTRO DE FERIADO */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>➕ Incluir Novo Feriado</Text>

              {/* CAMPO DE DATA COM DIA DA SEMANA DINÂMICO */}
              <View style={styles.field}>
                <Text style={styles.label}>Data do Feriado (DD/MM/AAAA) *</Text>
                <TextInput
                  value={holidayDate}
                  onChangeText={handleDateChange}
                  style={styles.input}
                  placeholder="Ex: 07/09/2026"
                  maxLength={10}
                  keyboardType="numeric"
                />

                {/* BADGE DE DIA DA SEMANA / VALIDAÇÃO */}
                {dateInfo.isValid && (
                  <View style={[styles.dayBadge, dateInfo.isPast ? styles.dayBadgePast : styles.dayBadgeFuture]}>
                    <Text style={[styles.dayBadgeText, dateInfo.isPast ? styles.dayBadgeTextPast : styles.dayBadgeTextFuture]}>
                      {dateInfo.isPast
                        ? `⚠️ ${dateInfo.label} (Data já passou - apenas datas futuras permitidas)`
                        : `📅 ${dateInfo.label} (Roleta Única)`}
                    </Text>
                  </View>
                )}
              </View>

              {/* NOME DO FERIADO */}
              <View style={styles.field}>
                <Text style={styles.label}>Nome / Descrição do Feriado *</Text>
                <TextInput
                  value={holidayName}
                  onChangeText={setHolidayName}
                  style={styles.input}
                  placeholder="Ex: Independência do Brasil / Padroeira da Cidade"
                />
              </View>

              {/* HORÁRIO DA ROLETA ÚNICA */}
              <View style={styles.field}>
                <Text style={styles.label}>Horário da Roleta Única</Text>
                <TextInput
                  value={holidayRoletaTime}
                  onChangeText={setHolidayRoletaTime}
                  style={styles.input}
                  placeholder="09:00"
                  maxLength={5}
                />
              </View>

              {/* ESCOPO DOS PLANTÕES */}
              <Text style={[styles.label, { marginTop: 8 }]}>Aplicar para quais plantões?</Text>
              <View style={styles.scopeRow}>
                <TouchableOpacity
                  style={[styles.scopeOption, holidayScope === 'all' && styles.scopeOptionActive]}
                  onPress={() => setHolidayScope('all')}
                >
                  <Text style={[styles.scopeText, holidayScope === 'all' && styles.scopeTextActive]}>
                    🔘 Todos os Plantões da Construtora
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.scopeOption, holidayScope === 'specific' && styles.scopeOptionActive]}
                  onPress={() => setHolidayScope('specific')}
                >
                  <Text style={[styles.scopeText, holidayScope === 'specific' && styles.scopeTextActive]}>
                    🔘 Plantões Específicos
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SELEÇÃO DE PLANTÕES ESPECÍFICOS */}
              {holidayScope === 'specific' && (
                <View style={styles.specificBoothsBox}>
                  <Text style={styles.specificBoothsTitle}>Selecione os plantões que terão Roleta Única neste feriado:</Text>
                  {booths.map((booth) => {
                    const isChecked = selectedHolidayBoothIds.includes(booth.id);
                    return (
                      <TouchableOpacity
                        key={booth.id}
                        style={[styles.boothCheckboxItem, isChecked && styles.boothCheckboxItemChecked]}
                        onPress={() => toggleBoothHolidaySelection(booth.id)}
                      >
                        <Text style={styles.checkboxIcon}>{isChecked ? '☑️' : '⬜'}</Text>
                        <Text style={[styles.checkboxLabel, isChecked && { fontWeight: 'bold', color: '#1c1c1e' }]}>
                          {booth.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* BOTÃO DE CADASTRAR FERIADO */}
              <TouchableOpacity
                style={[styles.save, (creatingHoliday || dateInfo.isPast) && { opacity: 0.6 }]}
                onPress={handleCreateHoliday}
                disabled={creatingHoliday || dateInfo.isPast}
              >
                {creatingHoliday ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>➕ Cadastrar Feriado com Roleta Única</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* LISTAGEM DE FERIADOS CADASTRADOS */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📋 Feriados Cadastrados no Sistema</Text>
              {loadingHolidays ? (
                <ActivityIndicator color="#1c1c1e" style={{ marginVertical: 16 }} />
              ) : holidays.length === 0 ? (
                <Text style={styles.empty}>Nenhum feriado cadastrado até o momento. Utilize o formulário acima para cadastrar.</Text>
              ) : (
                <View style={{ gap: 10, marginTop: 10 }}>
                  {holidays.map((h) => (
                    <View key={h.id} style={styles.holidayCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={styles.holidayDate}>{formatDateDisplay(h.date)}</Text>
                          <View style={styles.holidayDayTag}>
                            <Text style={styles.holidayDayTagText}>{getHolidayDayOfWeek(h.date)}</Text>
                          </View>
                        </View>
                        <Text style={styles.holidayName}>{h.name}</Text>
                        <Text style={styles.holidayDetails}>
                          ⏰ Roleta Única às <Text style={{ fontWeight: 'bold' }}>{h.roleta_time}</Text> | 📍 {h.boothName}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteHolidayButton}
                        onPress={() => handleDeleteHoliday(h)}
                      >
                        <Text style={styles.deleteHolidayButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdecea' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  backText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0b5ab',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1c1c1e',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#c13a28',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#1c1c1e',
    fontWeight: '800',
  },
  content: { padding: 20, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center' },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 6 },
  description: { color: '#c13a28', lineHeight: 20, marginBottom: 18 },
  label: { color: '#333', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  boothToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  newBoothButton: { backgroundColor: '#1c1c1e', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  newBoothText: { color: '#fff', fontWeight: '800' },
  boothRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  boothButton: { borderWidth: 1, borderColor: '#f0b5ab', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  boothButtonActive: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  boothText: { color: '#333' },
  boothTextActive: { color: '#fff', fontWeight: '700' },
  sectionTitle: { color: '#1c1c1e', fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 8 },
  lifecycle: { color: '#0f766e', fontWeight: '800', marginBottom: 12, textTransform: 'uppercase' },
  version: { color: '#c13a28', marginBottom: 12 },
  field: { marginBottom: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0b5ab',
  },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0b5ab', borderRadius: 8, padding: 12, fontSize: 15 },
  reason: { minHeight: 80, textAlignVertical: 'top' },
  toggle: { padding: 14, borderRadius: 8, backgroundColor: '#f5d2cd', marginBottom: 16 },
  toggleText: { color: '#1c1c1e', fontWeight: '700' },
  saveSecondary: { backgroundColor: '#f0b5ab', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 8 },
  saveSecondaryText: { color: '#1c1c1e', fontWeight: '800', fontSize: 15 },
  lifecycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  lifecycleButton: { backgroundColor: '#dbeafe', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  lifecycleButtonText: { color: '#1e3a8a', fontWeight: '800' },
  save: { backgroundColor: '#1c1c1e', borderRadius: 8, padding: 15, alignItems: 'center', marginTop: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { color: '#c13a28', paddingVertical: 14, textAlign: 'center' },
  dayBadge: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dayBadgeFuture: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
    borderWidth: 1,
  },
  dayBadgePast: {
    backgroundColor: '#fee2e2',
    borderColor: '#f87171',
    borderWidth: 1,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayBadgeTextFuture: {
    color: '#0369a1',
  },
  dayBadgeTextPast: {
    color: '#b91c1c',
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f5d2cd',
    borderWidth: 1,
    borderColor: '#f0b5ab',
  },
  dayChipActive: {
    backgroundColor: '#1c1c1e',
    borderColor: '#1c1c1e',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c13a28',
  },
  dayChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  scopeRow: {
    gap: 8,
    marginBottom: 12,
  },
  scopeOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    backgroundColor: '#fdecea',
  },
  scopeOptionActive: {
    borderColor: '#1c1c1e',
    backgroundColor: '#f5d2cd',
  },
  scopeText: {
    fontSize: 14,
    color: '#c13a28',
  },
  scopeTextActive: {
    fontWeight: '700',
    color: '#1c1c1e',
  },
  specificBoothsBox: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f0b5ab',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  specificBoothsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c13a28',
    marginBottom: 4,
  },
  boothCheckboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  boothCheckboxItemChecked: {
    backgroundColor: '#f0b5ab',
  },
  checkboxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#c13a28',
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f0b5ab',
    borderRadius: 10,
    padding: 14,
  },
  holidayDate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1c1c1e',
  },
  holidayDayTag: {
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  holidayDayTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  holidayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c13a28',
    marginBottom: 4,
  },
  holidayDetails: {
    fontSize: 12,
    color: '#c13a28',
  },
  deleteHolidayButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    marginLeft: 10,
  },
  deleteHolidayButtonText: {
    fontSize: 16,
  },
});
