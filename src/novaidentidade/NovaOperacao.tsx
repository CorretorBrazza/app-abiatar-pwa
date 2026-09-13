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
  Archive,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wifi,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';

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
  allowed_broker_stages?: string[];
};

type Holiday = {
  id: string;
  date: string;
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

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const STAGE_OPTIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'treinamento', label: 'Treinamento', hint: 'Fase inicial (em aprendizado)' },
  { key: 'estagiario', label: 'Estagiário', hint: 'Estágio (pré-CRECI)' },
  { key: 'corretor_creci', label: 'Creci', hint: 'Corretor com CRECI ativo' },
];

const LIFECYCLE_TONE: Record<string, 'positive' | 'attention' | 'neutral' | 'danger'> = {
  published: 'positive',
  paused: 'attention',
  draft: 'neutral',
  archived: 'danger',
};

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = d.getTime() < today.getTime();
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { label: DAY_NAMES[d.getDay()], isPast, isValid: true, isoDate };
}

function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function getHolidayDayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_NAMES[date.getDay()] || '';
}

const confirmDelete = (message: string) => (typeof window === 'undefined' ? true : window.confirm(message));

export default function NovaOperacao({ isMobile }: { isMobile?: boolean }) {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'booths' | 'holidays'>('booths');

  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState('');
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [rules, setRules] = useState<RuleSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBooth, setSavingBooth] = useState(false);
  const [reason, setReason] = useState('');
  const [roleta3Enabled, setRoleta3Enabled] = useState(false);
  const [allowedStages, setAllowedStages] = useState<string[]>(['treinamento', 'estagiario', 'corretor_creci']);

  const [specialSchedules, setSpecialSchedules] = useState<SpecialSchedule[]>([]);
  const [loadingSpecialSchedules, setLoadingSpecialSchedules] = useState(false);
  const [specialScope, setSpecialScope] = useState<'recurring' | 'one_off'>('one_off');
  const [specialDayOfWeek, setSpecialDayOfWeek] = useState<number>(0);
  const [specialRoletaTime, setSpecialRoletaTime] = useState('12:00');
  const [specialDescription, setSpecialDescription] = useState('');
  const [creatingSpecial, setCreatingSpecial] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayRoletaTime, setHolidayRoletaTime] = useState('09:00');
  const [holidayScope, setHolidayScope] = useState<'all' | 'specific'>('all');
  const [selectedHolidayBoothIds, setSelectedHolidayBoothIds] = useState<string[]>([]);
  const [creatingHoliday, setCreatingHoliday] = useState(false);

  const loadBooths = useCallback(async () => {
    try {
      const response = await api.get('/booths');
      const items = Array.isArray(response.data) ? response.data : [];
      setBooths(items);
      if (items[0] && !selectedBoothId) {
        setSelectedBoothId(items[0].id);
        setSelectedBooth(items[0]);
      }
    } catch {
      alert('Não foi possível carregar os plantões deste tenant.');
    } finally {
      setLoading(false);
    }
  }, [selectedBoothId]);

  const loadRules = useCallback(async (boothId: string) => {
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
      setAllowedStages(
        Array.isArray(response.data.allowed_broker_stages)
          ? response.data.allowed_broker_stages
          : ['treinamento', 'estagiario', 'corretor_creci'],
      );
      setReason('');
    } catch {
      alert('Não foi possível carregar as regras deste plantão.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpecialSchedules = useCallback(async (boothId: string) => {
    if (!boothId) return;
    setLoadingSpecialSchedules(true);
    try {
      const response = await api.get(`/booths/${boothId}/special-schedules`);
      setSpecialSchedules(Array.isArray(response.data) ? response.data : []);
    } catch {
      console.error('Erro ao carregar horários especiais:');
    } finally {
      setLoadingSpecialSchedules(false);
    }
  }, []);

  const loadHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const response = await api.get('/booths/holidays');
      setHolidays(Array.isArray(response.data) ? response.data : []);
    } catch {
      console.error('Erro ao carregar feriados:');
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  useEffect(() => {
    void loadBooths();
    void loadHolidays();
  }, [loadBooths, loadHolidays]);

  useEffect(() => {
    if (selectedBoothId) {
      setSelectedBooth(booths.find((b) => b.id === selectedBoothId) || null);
      void loadRules(selectedBoothId);
      void loadSpecialSchedules(selectedBoothId);
    }
  }, [selectedBoothId, booths, loadRules, loadSpecialSchedules]);

  const updateField = (key: keyof RuleSet, value: string) => {
    setRules((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateBoothField = (key: keyof Booth, value: string) => {
    setSelectedBooth((current) => (current ? { ...current, [key]: value } : current));
  };

  const toggleStage = (stage: string) => {
    setAllowedStages((current) =>
      current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage],
    );
  };

  const startNewBooth = () => {
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
  };

  const saveBooth = async () => {
    if (!selectedBooth) return;
    setSavingBooth(true);
    try {
      const base = {
        name: selectedBooth.name,
        address: selectedBooth.address,
        latitude: Number(selectedBooth.latitude),
        longitude: Number(selectedBooth.longitude),
        gpsRadius: Number(selectedBooth.gps_radius),
        minimumBrokersRequired: Number(selectedBooth.min_brokers_required),
        managerId: selectedBooth.manager_id || null,
        wifis: (selectedBooth.wifis || []).map((wifi) => wifi.ssid).filter(Boolean),
      };
      const response = selectedBoothId
        ? await api.patch(`/booths/${selectedBoothId}`, { ...base, reason: reason.trim() || 'Atualização do cadastro do plantão pela Diretoria' })
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
      setBooths((current) =>
        current.some((b) => b.id === response.data.id)
          ? current.map((b) => (b.id === response.data.id ? response.data : b))
          : [...current, response.data],
      );
      alert(selectedBoothId ? 'Cadastro-base do plantão atualizado e auditado.' : 'Plantão criado como rascunho. Configure as regras e publique quando estiver validado.');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível salvar o cadastro do plantão.');
    } finally {
      setSavingBooth(false);
    }
  };

  const changeLifecycle = async (action: 'publish' | 'pause' | 'archive') => {
    if (!selectedBoothId) return;
    try {
      const response = await api.post(`/booths/${selectedBoothId}/${action}`);
      setSelectedBooth(response.data);
      setBooths((current) => current.map((b) => (b.id === response.data.id ? response.data : b)));
      alert(action === 'publish' ? 'Plantão publicado para a operação.' : `Plantão ${action === 'pause' ? 'pausado' : 'arquivado'}.`);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível alterar o estado do plantão.');
    }
  };

  const saveRules = async () => {
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
        allowedBrokerStages: allowedStages,
        reason: reason.trim() || 'Atualização das regras da Roleta pela Diretoria',
      };
      const response = await api.patch(`/booths/${selectedBoothId}/rules`, payload);
      setRules(response.data);
      setReason('');
      alert('Regras da Roleta salvas com sucesso. Nova versão registrada na auditoria.');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível salvar as regras.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSpecialSchedule = async () => {
    if (!selectedBoothId) {
      alert('Selecione um plantão para cadastrar o horário especial.');
      return;
    }
    if (!specialRoletaTime.trim()) {
      alert('Informe o horário da Roleta Especial (ex: 12:00).');
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
      alert('Horário Especial cadastrado com sucesso! Este horário tem prioridade soberana sobre o horário padrão.');
      setSpecialDescription('');
      setSpecialRoletaTime('12:00');
      await loadSpecialSchedules(selectedBoothId);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível cadastrar o horário especial.');
    } finally {
      setCreatingSpecial(false);
    }
  };

  const handleDeleteSpecialSchedule = async (schedule: SpecialSchedule) => {
    if (!confirmDelete(`Deseja remover o horário especial '${schedule.description}' (${schedule.roleta_time})?`)) return;
    try {
      await api.delete(`/booths/special-schedules/${schedule.id}`);
      alert('Horário especial removido com sucesso.');
      if (selectedBoothId) await loadSpecialSchedules(selectedBoothId);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível remover.');
    }
  };

  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setHolidayDate(formatted);
  };

  const toggleBoothHolidaySelection = (id: string) => {
    setSelectedHolidayBoothIds((prev) => (prev.includes(id) ? prev.filter((bId) => bId !== id) : [...prev, id]));
  };

  const dateInfo = parseDateInfo(holidayDate);

  const handleCreateHoliday = async () => {
    if (!holidayDate.trim() || !holidayName.trim()) {
      alert('Por favor, preencha a data e o nome do feriado.');
      return;
    }
    if (!dateInfo.isValid) {
      alert('Por favor, informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    if (dateInfo.isPast) {
      alert('Apenas datas de hoje ou posteriores podem ser cadastradas como feriado.');
      return;
    }
    if (holidayScope === 'specific' && selectedHolidayBoothIds.length === 0) {
      alert('Selecione ao menos um plantão para aplicar o feriado.');
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
      alert(`Feriado '${holidayName}' cadastrado com sucesso com Roleta Única às ${holidayRoletaTime || '09:00'}!`);
      setHolidayDate('');
      setHolidayName('');
      setHolidayRoletaTime('09:00');
      setHolidayScope('all');
      setSelectedHolidayBoothIds([]);
      await loadHolidays();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível cadastrar o feriado.');
    } finally {
      setCreatingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!confirmDelete(`Deseja remover o feriado '${holiday.name}' (${formatDateDisplay(holiday.date)})?`)) return;
    try {
      await api.delete(`/booths/holidays/${holiday.id}`);
      alert('Feriado removido com sucesso.');
      await loadHolidays();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Não foi possível remover o feriado.');
    }
  };

  const lifecycle = selectedBooth?.lifecycle_status || 'draft';
  const tone = LIFECYCLE_TONE[lifecycle] || 'neutral';

  const pair = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, numeric?: boolean) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroBadge}>
            <Settings2 size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Diretoria · Operação</Text>
          </View>
          <Text style={styles.heroTitle}>Plantões, Roletas e regras.</Text>
          <Text style={styles.heroSubtitle}>Grade de horários, regras operacionais e feriados com roleta única.</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, activeTab === 'booths' && styles.tabActive]} onPress={() => setActiveTab('booths')}>
            <Building2 size={13} color={activeTab === 'booths' ? '#fff' : colors.slate500} />
            <Text style={[styles.tabText, activeTab === 'booths' && styles.tabTextActive]}>Plantões & Horários</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'holidays' && styles.tabActive]} onPress={() => setActiveTab('holidays')}>
            <CalendarDays size={13} color={activeTab === 'holidays' ? '#fff' : colors.slate500} />
            <Text style={[styles.tabText, activeTab === 'holidays' && styles.tabTextActive]}>Feriados (Roleta Única)</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'booths' && (
          <>
            <Text style={styles.sectionHeader}>Configuração Operacional dos Plantões</Text>
            <Text style={styles.sectionDesc}>
              Configure os horários de roleta, antecedência de check-in, janelas de pós-barra e metas de fim de semana por estande.
            </Text>

            <View style={styles.boothToolbar}>
              <Text style={styles.toolbarLabel}>Selecionar plantão de vendas:</Text>
              <TouchableOpacity style={styles.newBoothBtn} onPress={startNewBooth}>
                <Plus size={14} color="#fff" />
                <Text style={styles.newBoothText}>Novo plantão</Text>
              </TouchableOpacity>
            </View>

            {booths.length > 0 && (
              <View style={styles.boothRow}>
                {booths.map((booth) => (
                  <TouchableOpacity key={booth.id} style={[styles.boothBtn, selectedBoothId === booth.id && styles.boothBtnActive]} onPress={() => setSelectedBoothId(booth.id)}>
                    <Text style={[styles.boothText, selectedBoothId === booth.id && styles.boothTextActive]}>{booth.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!loading && !booths.length && !selectedBooth && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Nenhum plantão cadastrado neste tenant.</Text>
              </View>
            )}

            {selectedBooth && (
              <>
                {loading && !rules ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.coral600} />
                  </View>
                ) : (
                  <>
                    <View style={styles.card}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>1. Cadastro-Base do Plantão</Text>
                        <View style={[styles.lifecycleBadge, { backgroundColor: statusTone[tone].bg }]}>
                          <Text style={[styles.lifecycleText, { color: statusTone[tone].fg }]}>{lifecycle === 'draft' ? 'Rascunho' : lifecycle}</Text>
                        </View>
                      </View>

                      {pair('Nome do Empreendimento / Plantão', String(selectedBooth.name || ''), (v) => updateBoothField('name', v), 'Nome do plantão')}
                      {pair('Endereço do Plantão', String(selectedBooth.address || ''), (v) => updateBoothField('address', v), 'Endereço')}

                      <View style={styles.pairRow}>
                        <View style={styles.flex1}>{pair('Latitude', String(selectedBooth.latitude || ''), (v) => updateBoothField('latitude', v), undefined, true)}</View>
                        <View style={styles.flex1}>{pair('Longitude', String(selectedBooth.longitude || ''), (v) => updateBoothField('longitude', v), undefined, true)}</View>
                      </View>

                      <Text style={styles.fieldLabel}>Redes Wi-Fi Autorizadas (uma por linha)</Text>
                      <TextInput
                        value={(selectedBooth.wifis || []).map((w) => w.ssid).join('\n')}
                        onChangeText={(value) =>
                          setSelectedBooth({
                            ...selectedBooth,
                            wifis: value.split('\n').map((ssid) => ({ ssid: ssid.trim() })).filter((w) => w.ssid),
                          })
                        }
                        style={[styles.input, styles.multiline]}
                        multiline
                        placeholder="Ex: Wi-Fi_Plantao_01"
                        placeholderTextColor={colors.slate400}
                      />

                      <TouchableOpacity style={styles.primaryBtn} onPress={() => void saveBooth()} disabled={savingBooth}>
                        {savingBooth ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                        <Text style={styles.primaryBtnText}>{selectedBoothId ? 'Salvar Dados do Plantão' : 'Criar Plantão como Rascunho'}</Text>
                      </TouchableOpacity>

                      {selectedBoothId && (
                        <View style={styles.lifecycleRow}>
                          <TouchableOpacity style={[styles.lifecycleBtn, { borderColor: colors.green700 }]} onPress={() => void changeLifecycle('publish')}>
                            <CheckCircle2 size={13} color={colors.green700} />
                            <Text style={[styles.lifecycleBtnText, { color: colors.green700 }]}>Publicar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.lifecycleBtn, { borderColor: colors.amber700 }]} onPress={() => void changeLifecycle('pause')}>
                            <Clock size={13} color={colors.amber700} />
                            <Text style={[styles.lifecycleBtnText, { color: colors.amber700 }]}>Pausar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.lifecycleBtn, { borderColor: colors.red700 }]} onPress={() => void changeLifecycle('archive')}>
                            <Archive size={13} color={colors.red700} />
                            <Text style={[styles.lifecycleBtnText, { color: colors.red700 }]}>Arquivar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {rules && (
                      <>
                        <View style={styles.card}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle}>2. Grade de Horários das Roletas</Text>
                            <View style={[styles.versionBadge]}>
                              <Text style={styles.versionText}>v{rules.version}</Text>
                            </View>
                          </View>

                          <Text style={styles.sectionSub}>Corretores Permitidos Neste Plantão</Text>
                          <Text style={styles.sectionDesc}>
                            Somente os corretores das fases liberadas abaixo poderão fazer check-in neste plantão. Desligue todas para pausar temporariamente a liberação.
                          </Text>
                          <View style={styles.listBlock}>
                            {STAGE_OPTIONS.map((stage) => {
                              const on = allowedStages.includes(stage.key);
                              return (
                                <TouchableOpacity
                                  key={stage.key}
                                  style={[styles.toggle, { backgroundColor: on ? colors.green100 : colors.red100 }]}
                                  onPress={() => toggleStage(stage.key)}
                                >
                                  <Circle size={13} color={on ? colors.green700 : colors.red700} />
                                  <Text style={[styles.toggleText, { color: on ? colors.green700 : colors.red700 }]}>
                                    {stage.label} · {on ? 'LIBERADO' : 'BLOQUEADO'}
                                  </Text>
                                  <Text style={[styles.toggleHint, { color: on ? colors.green700 : colors.red700 }]}>{stage.hint}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Horário Roleta 1 (Manhã)', String(rules.roleta_1_time || '09:00'), (v) => updateField('roleta_1_time', v), '09:00')}</View>
                            <View style={styles.flex1}>{pair('Horário Roleta 2 (Tarde)', String(rules.roleta_2_time || '14:00'), (v) => updateField('roleta_2_time', v), '14:00')}</View>
                          </View>

                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>
                              <View style={styles.fieldLabelRow}>
                                <Text style={styles.fieldLabel}>3º Período (Noite)</Text>
                                <TouchableOpacity
                                  style={[styles.roleta3Toggle, { backgroundColor: roleta3Enabled ? colors.green100 : colors.slate100 }]}
                                  onPress={() => {
                                    const next = !roleta3Enabled;
                                    setRoleta3Enabled(next);
                                    if (!next) updateField('roleta_3_time', '');
                                    else if (!rules.roleta_3_time) updateField('roleta_3_time', '18:00');
                                  }}
                                >
                                  <Text style={[styles.roleta3ToggleText, { color: roleta3Enabled ? colors.green700 : colors.slate600 }]}>
                                    {roleta3Enabled ? 'HABILITADO' : 'DESABILITADO'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              <TextInput
                                value={String(rules.roleta_3_time || '')}
                                onChangeText={(v) => updateField('roleta_3_time', v)}
                                editable={roleta3Enabled}
                                style={[styles.input, !roleta3Enabled && { backgroundColor: colors.slate100, color: colors.slate400 }]}
                                placeholder={roleta3Enabled ? 'Ex: 18:00 ou 19:00' : 'Desabilitado (Sem 3ª roleta)'}
                                placeholderTextColor={colors.slate400}
                              />
                            </View>
                            <View style={styles.flex1}>{pair('Roleta Padrão Fim de Semana', String(rules.roleta_weekend_time || '09:00'), (v) => updateField('roleta_weekend_time', v), '09:00')}</View>
                          </View>

                          <Text style={styles.sectionSub}>3. Janelas de Entrada e Pós-Barra</Text>
                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Check-in Liberado (Minutos antes)', String(rules.checkin_early_minutes ?? 30), (v) => updateField('checkin_early_minutes', v), '30', true)}</View>
                            <View style={styles.flex1}>{pair('Tolerância Pós-Barra (Minutos após)', String(rules.pos_barra_minutes ?? 30), (v) => updateField('pos_barra_minutes', v), '30', true)}</View>
                          </View>

                          <Text style={styles.sectionSub}>4. Validação e Cômputo da Roleta</Text>
                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Tempo Mínimo para Validar (Minutos)', String(rules.minimum_period_minutes ?? 120), (v) => updateField('minimum_period_minutes', v), '120', true)}</View>
                            <View style={styles.flex1}>{pair('Meta Mensal de Roletas', String(rules.minimum_monthly_periods ?? 20), (v) => updateField('minimum_monthly_periods', v), '20', true)}</View>
                          </View>

                          <Text style={styles.sectionSub}>5. Elegibilidade para Fim de Semana</Text>
                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Roletas para Sábado (Seg a Sex)', String(rules.saturday_required_periods ?? 5), (v) => updateField('saturday_required_periods', v), '5', true)}</View>
                            <View style={styles.flex1}>{pair('Roletas para Domingo (Seg a Sex)', String(rules.sunday_required_periods ?? 6), (v) => updateField('sunday_required_periods', v), '6', true)}</View>
                          </View>

                          <TouchableOpacity style={[styles.toggle, { backgroundColor: rules.weekend_enabled ? colors.green100 : colors.red100 }]} onPress={() => setRules({ ...rules, weekend_enabled: !rules.weekend_enabled })}>
                            <Circle size={13} color={rules.weekend_enabled ? colors.green700 : colors.red700} />
                            <Text style={[styles.toggleText, { color: rules.weekend_enabled ? colors.green700 : colors.red700 }]}>
                              Habilitar Roletas em Fins de Semana: {rules.weekend_enabled ? 'SIM (Ativo)' : 'NÃO (Bloqueado)'}
                            </Text>
                          </TouchableOpacity>

                          <Text style={styles.sectionSub}>6. Parâmetros de Presença e Segurança</Text>
                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Raio GPS Permitido (Metros)', String(rules.gps_radius_meters ?? 100), (v) => updateField('gps_radius_meters', v), '100', true)}</View>
                            <View style={styles.flex1}>{pair('Mínimo de Corretores no Plantão', String(rules.minimum_brokers_required ?? 2), (v) => updateField('minimum_brokers_required', v), '2', true)}</View>
                          </View>
                          <View style={styles.pairRow}>
                            <View style={styles.flex1}>{pair('Intervalo de Confirmação (Minutos)', String(rules.ping_interval_minutes ?? 30), (v) => updateField('ping_interval_minutes', v), '30', true)}</View>
                            <View style={styles.flex1}>{pair('Prazo de Resposta (Minutos)', String(rules.ping_response_deadline_minutes ?? 5), (v) => updateField('ping_response_deadline_minutes', v), '5', true)}</View>
                          </View>

                          <Text style={styles.fieldLabel}>Motivo da Alteração das Regras (Auditoria)</Text>
                          <TextInput
                            value={reason}
                            onChangeText={setReason}
                            style={[styles.input, styles.multiline]}
                            multiline
                            placeholder="Informe o motivo para a trilha de auditoria"
                            placeholderTextColor={colors.slate400}
                          />

                          <TouchableOpacity style={styles.primaryBtn} onPress={() => void saveRules()} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                            <Text style={styles.primaryBtnText}>Salvar Regras da Roleta</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.card}>
                          <View style={styles.cardTitleRow}>
                            <Text style={[styles.cardTitle, { flex: 1 }]}>7. Horários Especiais do Plantão (Soberanos)</Text>
                            <View style={styles.sovereignBadge}>
                              <Text style={styles.sovereignText}>SOBERANIA MÁXIMA</Text>
                            </View>
                          </View>
                          <Text style={styles.sectionDesc}>
                            Configure horários diferenciados de abertura e Roleta Única exclusivos para este plantão (ex: shoppings aos domingos, eventos ou feriados). O horário especial tem prioridade soberana e substitui a grade padrão.
                          </Text>

                          <Text style={styles.fieldLabel}>Dia da Semana:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                            <View style={styles.dayRow}>
                              {DAY_NAMES.map((name, idx) => (
                                <TouchableOpacity key={name} style={[styles.dayChip, specialDayOfWeek === idx && styles.dayChipActive]} onPress={() => setSpecialDayOfWeek(idx)}>
                                  <Text style={[styles.dayChipText, specialDayOfWeek === idx && styles.dayChipTextActive]}>{name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>

                          <Text style={styles.fieldLabel}>Frequência de Aplicação:</Text>
                          <View style={styles.scopeRow}>
                            <TouchableOpacity style={[styles.scopeOption, specialScope === 'one_off' && styles.scopeOptionActive, styles.flex1]} onPress={() => setSpecialScope('one_off')}>
                              <Text style={[styles.scopeText, specialScope === 'one_off' && styles.scopeTextActive]}>Somente o Próximo ({DAY_NAMES[specialDayOfWeek]})</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.scopeOption, specialScope === 'recurring' && styles.scopeOptionActive, styles.flex1]} onPress={() => setSpecialScope('recurring')}>
                              <Text style={[styles.scopeText, specialScope === 'recurring' && styles.scopeTextActive]}>Todos os ({DAY_NAMES[specialDayOfWeek]}s)</Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.pairRow}>
                            <View style={[styles.flex1]}>
                              <Text style={styles.fieldLabel}>Horário da Roleta Única *</Text>
                              <TextInput style={styles.input} value={specialRoletaTime} onChangeText={setSpecialRoletaTime} placeholder="12:00" placeholderTextColor={colors.slate400} />
                            </View>
                            <View style={styles.flex2}>
                              <Text style={styles.fieldLabel}>Motivo / Descrição</Text>
                              <TextInput style={styles.input} value={specialDescription} onChangeText={setSpecialDescription} placeholder="Ex: Abertura Shopping às 12h" placeholderTextColor={colors.slate400} />
                            </View>
                          </View>

                          <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleCreateSpecialSchedule()} disabled={creatingSpecial}>
                            {creatingSpecial ? <ActivityIndicator size="small" color="#fff" /> : <CalendarRange size={14} color="#fff" />}
                            <Text style={styles.primaryBtnText}>Adicionar Horário Especial Soberano</Text>
                          </TouchableOpacity>

                          <View style={styles.listBlock}>
                            <Text style={styles.listTitle}>
                              Horários Especiais Cadastrados para {selectedBooth?.name || 'este plantão'} ({specialSchedules.length})
                            </Text>
                            {loadingSpecialSchedules ? (
                              <ActivityIndicator size="small" color={colors.coral600} />
                            ) : specialSchedules.length === 0 ? (
                              <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>Nenhum horário especial configurado para este estande. O plantão seguirá a grade regular padrão.</Text>
                              </View>
                            ) : (
                              <View style={{ gap: 8 }}>
                                {specialSchedules.map((schedule) => (
                                  <View key={schedule.id} style={styles.scheduleRow}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                      <View style={styles.scheduleHeaderRow}>
                                        <View style={styles.sovereignBadge}>
                                          <Text style={styles.sovereignText}>SOBERANO</Text>
                                        </View>
                                        <Text style={styles.scheduleTitle}>Roleta às {schedule.roleta_time}</Text>
                                      </View>
                                      <Text style={styles.scheduleDesc}>{schedule.description}</Text>
                                      <Text style={styles.scheduleMeta}>
                                        {schedule.scope === 'one_off'
                                          ? `Pontual: ${schedule.specific_date ? formatDateDisplay(schedule.specific_date) : 'Próxima data'} (${schedule.day_of_week !== null ? DAY_NAMES[schedule.day_of_week] : ''})`
                                          : `Recorrente: Todos os ${schedule.day_of_week !== null ? DAY_NAMES[schedule.day_of_week] : ''}s`}
                                      </Text>
                                    </View>
                                    <TouchableOpacity style={styles.deleteBtn} onPress={() => void handleDeleteSpecialSchedule(schedule)}>
                                      <Trash2 size={14} color={colors.red700} />
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
              </>
            )}
            {!booths.length && !selectedBooth && !loading && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Nenhum plantão cadastrado neste tenant.</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'holidays' && (
          <>
            <Text style={styles.sectionHeader}>Gestão de Feriados (Roleta Única)</Text>
            <Text style={styles.sectionDesc}>
              Cadastre feriados nacionais, estaduais, municipais ou pontos facultativos. Nesses dias, os plantões configurados operarão com Roleta Única no horário determinado.
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Incluir Novo Feriado</Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Data do Feriado (DD/MM/AAAA) *</Text>
                <TextInput
                  value={holidayDate}
                  onChangeText={handleDateChange}
                  style={styles.input}
                  placeholder="Ex: 07/09/2026"
                  placeholderTextColor={colors.slate400}
                  maxLength={10}
                  keyboardType="numeric"
                />
                {dateInfo.isValid && (
                  <View style={[styles.dayBadge, { backgroundColor: dateInfo.isPast ? colors.red100 : colors.green100 }]}>
                    <Text style={[styles.dayBadgeText, { color: dateInfo.isPast ? colors.red700 : colors.green700 }]}>
                      {dateInfo.isPast ? `${dateInfo.label} (Data já passou - apenas datas futuras permitidas)` : `${dateInfo.label} (Roleta Única)`}
                    </Text>
                  </View>
                )}
              </View>

              {pair('Nome / Descrição do Feriado *', holidayName, setHolidayName, 'Ex: Independência do Brasil / Padroeira da Cidade')}
              {pair('Horário da Roleta Única', holidayRoletaTime, setHolidayRoletaTime, '09:00')}

              <Text style={styles.fieldLabel}>Aplicar para quais plantões?</Text>
              <View style={styles.scopeRow}>
                <TouchableOpacity style={[styles.scopeOption, holidayScope === 'all' && styles.scopeOptionActive, styles.flex1]} onPress={() => setHolidayScope('all')}>
                  <Text style={[styles.scopeText, holidayScope === 'all' && styles.scopeTextActive]}>Todos os Plantões da Construtora</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.scopeOption, holidayScope === 'specific' && styles.scopeOptionActive, styles.flex1]} onPress={() => setHolidayScope('specific')}>
                  <Text style={[styles.scopeText, holidayScope === 'specific' && styles.scopeTextActive]}>Plantões Específicos</Text>
                </TouchableOpacity>
              </View>

              {holidayScope === 'specific' && (
                <View style={styles.specificBoothsBox}>
                  <Text style={styles.listTitle}>Selecione os plantões que terão Roleta Única neste feriado:</Text>
                  {booths.map((booth) => {
                    const isChecked = selectedHolidayBoothIds.includes(booth.id);
                    return (
                      <TouchableOpacity key={booth.id} style={[styles.checkboxItem, isChecked && styles.checkboxItemChecked]} onPress={() => toggleBoothHolidaySelection(booth.id)}>
                        {isChecked ? <CheckCircle2 size={14} color={colors.green700} /> : <Circle size={14} color={colors.slate400} />}
                        <Text style={[styles.checkboxLabel, isChecked && { fontWeight: '800', color: semantic.textPrimary }]}>{booth.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleCreateHoliday()} disabled={creatingHoliday || dateInfo.isPast}>
                {creatingHoliday ? <ActivityIndicator size="small" color="#fff" /> : <CalendarDays size={14} color="#fff" />}
                <Text style={styles.primaryBtnText}>Cadastrar Feriado</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Feriados Cadastrados no Sistema</Text>
              {loadingHolidays ? (
                <ActivityIndicator color={colors.coral600} style={{ marginVertical: 16 }} />
              ) : holidays.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Nenhum feriado cadastrado até o momento. Utilize o formulário acima para cadastrar.</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {holidays.map((h) => (
                    <View key={h.id} style={styles.holidayRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.scheduleHeaderRow}>
                          <Text style={styles.holidayDate}>{formatDateDisplay(h.date)}</Text>
                          <View style={[styles.dayChip, styles.dayChipActive]}>
                            <Text style={styles.dayChipTextActive}>{getHolidayDayOfWeek(h.date)}</Text>
                          </View>
                        </View>
                        <Text style={styles.holidayName}>{h.name}</Text>
                        <Text style={styles.holidayDetails}>
                          Roleta Única às <Text style={{ fontWeight: '800' }}>{h.roleta_time}</Text> | {h.boothName}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => void handleDeleteHoliday(h)}>
                        <Trash2 size={14} color={colors.red700} />
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
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 860, width: '100%', alignSelf: 'center' },
  hero: { borderRadius: radius.lg, padding: 20, backgroundColor: colors.navy900, ...shadow.card },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 16 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card,
  },
  tabActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  tabText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  sectionHeader: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  sectionDesc: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, lineHeight: 17 },
  sectionSub: { color: colors.slate800, fontFamily: font.body, fontWeight: '800', fontSize: 12, marginTop: 14, marginBottom: 6 },
  boothToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  toolbarLabel: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  newBoothBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 13,
  },
  newBoothText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  boothRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boothBtn: {
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 13, backgroundColor: semantic.card,
  },
  boothBtnActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  boothText: { color: colors.slate600, fontFamily: font.body, fontWeight: '600', fontSize: 11.5 },
  boothTextActive: { color: '#fff', fontWeight: '800' },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  cardTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14.5, letterSpacing: -0.2 },
  cardSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  lifecycleBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  lifecycleText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  versionBadge: { backgroundColor: colors.slate100, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 9 },
  versionText: { color: colors.slate600, fontFamily: font.body, fontWeight: '800', fontSize: 10 },
  field: { gap: 6 },
  fieldLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  fieldLabelText: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  input: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 11, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
  pairRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  roleta3Toggle: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: semantic.border },
  roleta3ToggleText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border,
  },
  toggleText: { fontFamily: font.body, fontWeight: '800', fontSize: 11.5 },
  toggleHint: { fontFamily: font.body, fontWeight: '600', fontSize: 10.5, marginLeft: 'auto' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  lifecycleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifecycleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: semantic.card,
  },
  lifecycleBtnText: { fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  sovereignBadge: { backgroundColor: colors.amber100, borderWidth: 1, borderColor: colors.amber700, borderRadius: radius.sm, paddingVertical: 3, paddingHorizontal: 8 },
  sovereignText: { color: colors.amber700, fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  dayRow: { flexDirection: 'row', gap: 6 },
  dayChip: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full,
    borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card,
  },
  dayChipActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  dayChipText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  dayChipTextActive: { color: '#fff' },
  scopeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  scopeOption: {
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.slate050,
  },
  scopeOptionActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  scopeText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  scopeTextActive: { color: '#fff' },
  listBlock: { gap: 8, marginTop: 6 },
  listTitle: { color: colors.slate800, fontFamily: font.body, fontWeight: '800', fontSize: 11.5 },
  emptyBox: { backgroundColor: colors.slate050, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: semantic.border },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, fontStyle: 'italic' },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.coral050, borderWidth: 1, borderColor: colors.coral300,
    borderRadius: radius.md, padding: 12,
  },
  scheduleHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  scheduleTitle: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 12.5 },
  scheduleDesc: { color: colors.coral700, fontFamily: font.body, fontWeight: '600', fontSize: 11, marginTop: 2 },
  scheduleMeta: { color: colors.coral700, fontFamily: font.body, fontSize: 10.5, marginTop: 2 },
  deleteBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.red300, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  dayBadge: { marginTop: 6, borderRadius: radius.md, paddingVertical: 7, paddingHorizontal: 10 },
  dayBadgeText: { fontFamily: font.body, fontWeight: '700', fontSize: 10.5 },
  checkboxItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 11, backgroundColor: semantic.card,
  },
  checkboxItemChecked: { borderColor: colors.green700, backgroundColor: colors.green100 },
  checkboxLabel: { color: colors.slate600, fontFamily: font.body, fontWeight: '600', fontSize: 11.5, flex: 1 },
  holidayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: semantic.card, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border,
    padding: 13,
  },
  holidayDate: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  holidayName: { color: colors.slate800, fontFamily: font.body, fontWeight: '700', fontSize: 12, marginTop: 2 },
  holidayDetails: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 2 },
  specificBoothsBox: { gap: 8 },
  loadingBox: { padding: 40, alignItems: 'center' },
});