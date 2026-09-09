import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';

// ========================= TIPOS =========================

interface HealthData {
  status: string;
  checkedAt: string;
  executionDurationMs: number;
  database: { status: string; latencyMs: number; provider: string };
  system: {
    nodeVersion: string;
    environment: string;
    uptime: string;
    memory: { rss: string; heapUsed: string; heapTotal: string };
  };
  counts: {
    tenants: number;
    users: number;
    booths: number;
    presencesToday: number;
    auditLogs: number;
    pushTokens: number;
  };
  usersByRole: Array<{ role: string; count: string }>;
  integrations: {
    resend: { configured: boolean; fromDomain: string; status: string };
    firebase: { configured: boolean; registeredTokens: number; status: string };
  };
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
  status_assinatura: string;
  limite_plantoes: number;
  limite_corretores: number;
  created_at: string;
  stats: {
    totalUsers: number;
    totalBrokers: number;
    totalManagers: number;
    totalBooths: number;
    presencesToday: number;
  };
}

interface AuditItem {
  id: string;
  created_at: string;
  action: string;
  actor_email_snapshot?: string;
  actor_role?: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  success: boolean;
  ip_address?: string;
}

interface DbStatus {
  checkedAt: string;
  executionDurationMs: number;
  databaseSize: { size_pretty: string; size_mb: string };
  migrations: {
    count: number;
    last: { id: number; applied_at_ms: string; name: string } | null;
    applied: Array<{ id: number; applied_at_ms: string; name: string }>;
  };
  tables: Array<{ table_name: string; live_rows: number; dead_rows: number }>;
  enums: Record<string, string[]>;
  indexes: Array<{ tablename: string; indexname: string; indexdef: string }>;
  checks: Record<string, any> & { rowCounts?: Record<string, number> };
}

interface LiveOverview {
  updatedAt: string;
  overall: {
    totalOnline: number;
    awaitingRevalidation: number;
    pendingPings: number;
    todayCheckins: number;
  };
  statusBreakdownToday: Record<string, number>;
  booths: Array<{
    boothId: string;
    boothName: string;
    tenantName: string;
    lifecycleStatus: string;
    onlineCount: number;
    awaitingRevalidation: number;
    todayCheckins: number;
    onlineBrokers: Array<{
      presenceId: string;
      brokerId: string;
      nomeGuerra: string;
      roletaPosition: number | null;
      roletaName: string | null;
      checkInAt: string;
    }>;
  }>;
  deadmanRecent: Array<{
    id: string;
    sentAt: string;
    respondedAt: string | null;
    responseStatus: string;
    brokerId: string | null;
    nomeGuerra: string;
    boothName: string;
    tenantName: string;
  }>;
}

interface UserRow {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  role: string;
  status: string;
  broker_stage: string | null;
  approved_by_hr: boolean;
  must_change_password: boolean;
  leads_paused: boolean;
  last_checkin_at: string | null;
  removed_at: string | null;
  created_at: string;
  tenantName: string;
  tenantSlug: string;
  presencesToday: number;
}

interface UsersPayload {
  total: number;
  page: number;
  limit: number;
  users: UserRow[];
}

interface UserProfile {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  role: string;
  status: string;
  broker_stage: string | null;
  creci: string | null;
  approved_by_hr: boolean;
  last_checkin_at: string | null;
  created_at: string;
  tenant: { id: string; name: string; slug: string } | null;
  presences: { total: number; today: number; byStatus: Record<string, number> };
  recentPresences: Array<{
    id: string;
    status: string;
    checkInAt: string | null;
    attendedAt: string | null;
    boothName: string;
    roletaName: string | null;
    roletaPosition: number | null;
    accumulatedMinutes: number;
  }>;
}

interface GridPosition {
  presenceId: string;
  brokerId: string;
  nomeGuerra: string;
  roletaPosition: number | null;
  roletaEntryType: string | null;
  checkInAt: string;
  minutesActive: number;
  lastConfirmedAt: string | null;
  nextConfirmationAt: string | null;
  accumulatedMinutes: number;
  hasPendingPing: boolean;
}

interface RoletaGroup {
  roletaName: string;
  waitingDraw: number;
  positions: Array<GridPosition>;
}

interface PendingPingItem {
  id: string;
  presenceId: string;
  brokerId: string | null;
  nomeGuerra: string;
  boothId: string | null;
  boothName: string;
  tenantName: string;
  sentAt: string;
  minutesSince: number;
  deadlineMinutes: number;
  overdue: boolean;
}

interface BoothGridItem {
  boothId: string;
  boothName: string;
  tenantId: string;
  tenantName: string;
  address: string | null;
  lifecycleStatus: string;
  publishedAt: string | null;
  wifiCount: number;
  minBrokersRequired: number;
  gpsRadius: number;
  ruleVersion: number | null;
  roletaSchedule: {
    roleta1: string | null;
    roleta2: string | null;
    roleta3: string | null;
    weekend: string | null;
    checkinEarlyMinutes: number;
    posBarraMinutes: number;
    pingIntervalMinutes: number;
    pingDeadlineMinutes: number;
  } | null;
  onlineCount: number;
  awaitingRevalidation: number;
  pendingPingCount: number;
  todayCheckins: number;
  lastCheckInAt: string | null;
  coverageOk: boolean;
  coverageGap: number;
  currentRoletas: RoletaGroup[];
}

interface BrokerOverviewData {
  updatedAt: string;
  overall: {
    onlineTotal: number;
    awaitingRevalidation: number;
    waitingDraw: number;
    inQueue: number;
    pendingPingsTotal: number;
  };
  byBooth: Array<{
    boothId: string;
    boothName: string;
    tenantName: string;
    lifecycleStatus: string;
    onlineCount: number;
    awaitingRevalidation: number;
    pendingPingCount: number;
    coverageOk: boolean;
    coverageGap: number;
    waitingDraw: number;
    inQueue: number;
    roletas: RoletaGroup[];
  }>;
  pendingPings: Array<PendingPingItem>;
}

interface DeadmanOverviewData {
  updatedAt: string;
  summary: {
    totalOnline: number;
    pending: number;
    overdue: number;
    aboutToPing: number;
    suspendedToday: number;
  };
  status24h: Record<string, number>;
  pendingPings: Array<PendingPingItem>;
  aboutToPing: Array<{
    presenceId: string;
    brokerId: string;
    nomeGuerra: string;
    boothId: string;
    boothName: string;
    tenantName: string;
    nextConfirmationAt: string;
    minutesOverdue: number;
  }>;
}

interface StatsHistoryData {
  updatedAt: string;
  days: number;
  perDay: Array<{
    date: string;
    total: number;
    online: number;
    completed: number;
    invalidated: number;
    absent: number;
    paused: number;
  }>;
  today: { total: number; byStatus: Record<string, number> };
  topBrokersToday: Array<{ nome_guerra: string; email: string; tenant_name: string; checkins: string | number; minutes_sum: string | number }>;
  boothCheckinsToday: Array<{ booth_id: string; booth_name: string; lifecycle_status: string; checkins: string | number }>;
}

interface SqlResultData {
  success: boolean;
  durationMs: number;
  rowCount: number;
  truncated: boolean;
  columns: string[];
  rows: Array<Record<string, any>>;
}

// ========================= RÓTULOS =========================

const ROLE_LABELS: Record<string, string> = {
  platform_admin_level_0: 'SuperAdmin',
  diretoria_level_1: 'Diretoria',
  gerencia_level_2: 'Gerência',
  rh_level_2: 'RH',
  rh_level_1: 'RH',
  recepcao_level_3: 'Recepção',
  corretor_level_3: 'Corretor',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  grace_period: 'Graça',
};

const PRESENCE_STATUS_LABELS: Record<string, string> = {
  online: 'On-line',
  paused: 'Pausado',
  absent: 'Ausente',
  completed: 'Concluído',
  invalidated: 'Invalidado',
};

const DEADMAN_STATUS_COLOR: Record<string, string> = {
  pending: '#eab308',
  valid_gps: '#22c55e',
  valid_wifi: '#22c55e',
  valid_reception: '#38bdf8',
  outside_area: '#ef4444',
  no_response: '#f97316',
};

// ========================= COMPONENTES AUXILIARES =========================

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function formatDate(value?: string | Date | number | null) {
  if (!value && value !== 0) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ========================= PAINEL PRINCIPAL =========================

export default function DevDashboard({ onBack }: { onBack: () => void }) {
  const [devToken, setDevToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('@abiatar:dev_token');
    }
    return null;
  });

  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  type TabKey = 'health' | 'tenants' | 'audit' | 'tools' | 'db' | 'live' | 'users' | 'broker' | 'deadman' | 'stats' | 'sql';
  const [currentTab, setCurrentTab] = useState<TabKey>('health');

  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [liveData, setLiveData] = useState<LiveOverview | null>(null);
  const [liveTenantFilter, setLiveTenantFilter] = useState<string>('');
  const [gridData, setGridData] = useState<BoothGridItem[]>([]);

  const [brokerData, setBrokerData] = useState<BrokerOverviewData | null>(null);
  const [deadmanData, setDeadmanData] = useState<DeadmanOverviewData | null>(null);
  const [statsData, setStatsData] = useState<StatsHistoryData | null>(null);
  const [statsDays, setStatsDays] = useState(14);
  const [statsTenantFilter, setStatsTenantFilter] = useState<string>('');

  const [sqlInput, setSqlInput] = useState('');
  const [sqlResult, setSqlResult] = useState<SqlResultData | null>(null);
  const [runningSql, setRunningSql] = useState(false);

  const [usersPayload, setUsersPayload] = useState<UsersPayload | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userTenantFilter, setUserTenantFilter] = useState('');
  const [userPage, setUserPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [newTenantColor, setNewTenantColor] = useState('#E31C1C');
  const [newTenantLogo, setNewTenantLogo] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminNomeGuerra, setNewAdminNomeGuerra] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testPushTitle, setTestPushTitle] = useState('Teste de Notificação DEV');
  const [testPushBody, setTestPushBody] = useState('Mensagem de telemetria enviada pelo SuperAdmin.');
  const [testPushScope, setTestPushScope] = useState<'first5' | 'all'>('first5');
  const [testPushUserId, setTestPushUserId] = useState('');
  const [testPushTenantId, setTestPushTenantId] = useState('');
  const [sendingTestPush, setSendingTestPush] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [expandedBooth, setExpandedBooth] = useState<string | null>(null);

  // ============ AUTENTICAÇÃO ============

  const handleAuth = async () => {
    if (!masterKeyInput.trim()) {
      setAuthError('Informe a chave mestra de desenvolvedor.');
      return;
    }
    try {
      setAuthLoading(true);
      setAuthError('');
      const res = await api.post('/dev/auth', { masterKey: masterKeyInput.trim() });
      if (res.data?.token) {
        setDevToken(res.data.token);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('@abiatar:dev_token', res.data.token);
        }
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Chave mestra inválida.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutDev = () => {
    setDevToken(null);
    setHealthData(null);
    setDbStatus(null);
    setLiveData(null);
    setGridData([]);
    setUsersPayload(null);
    setBrokerData(null);
    setDeadmanData(null);
    setStatsData(null);
    setSqlResult(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('@abiatar:dev_token');
    }
  };

  const getDevHeaders = useCallback(() => {
    return { headers: { Authorization: `Bearer ${devToken}` } };
  }, [devToken]);

  // ============ CARREGADORES ============

  const loadHealth = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/health', getDevHeaders());
      setHealthData(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) handleLogoutDev();
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  const loadTenants = useCallback(async () => {
    if (!devToken) return;
    try {
      const res = await api.get('/dev/tenants', getDevHeaders());
      setTenants(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar tenants:', err);
    }
  }, [devToken, getDevHeaders]);

  const loadAuditLogs = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/audit-logs', {
        ...getDevHeaders(),
        params: { page: auditPage, limit: 20, search: auditSearch },
      });
      setAuditLogs(res.data?.logs || []);
      setAuditTotal(res.data?.total || 0);
    } catch (err: any) {
      console.error('Erro ao carregar audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [devToken, auditPage, auditSearch, getDevHeaders]);

  const loadDbStatus = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/db/status', getDevHeaders());
      setDbStatus(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao consultar o banco: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  const loadLiveOverview = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/live/overview', {
        ...getDevHeaders(),
        params: liveTenantFilter ? { tenantId: liveTenantFilter } : {},
      });
      setLiveData(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar diagnóstico ao vivo: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, liveTenantFilter, getDevHeaders]);

  const loadUsers = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/users', {
        ...getDevHeaders(),
        params: {
          search: userSearch || undefined,
          tenantId: userTenantFilter || undefined,
          role: userRoleFilter || undefined,
          status: userStatusFilter || undefined,
          page: userPage,
          limit: 15,
        },
      });
      setUsersPayload(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao listar usuários: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, userSearch, userTenantFilter, userRoleFilter, userStatusFilter, userPage, getDevHeaders]);

  const loadBoothGrid = useCallback(async () => {
    if (!devToken) return;
    try {
      const res = await api.get('/dev/booths/grid', {
        ...getDevHeaders(),
        params: liveTenantFilter ? { tenantId: liveTenantFilter } : {},
      });
      setGridData(res.data?.booths || []);
    } catch (err: any) {
      console.error('Erro ao carregar grade de plantões:', err);
    }
  }, [devToken, liveTenantFilter, getDevHeaders]);

  const loadBrokerOverview = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/broker/overview', getDevHeaders());
      setBrokerData(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar filas/broker: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  const loadDeadmanOverview = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/deadman/overview', getDevHeaders());
      setDeadmanData(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar monitor deadman: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  const loadStatsHistory = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/stats/history', {
        ...getDevHeaders(),
        params: { days: statsDays, tenantId: statsTenantFilter || undefined },
      });
      setStatsData(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar histórico: ' + (err.response?.data?.message || err.message) });
    } finally {
      setLoading(false);
    }
  }, [devToken, statsDays, statsTenantFilter, getDevHeaders]);

  const handleRunSql = async () => {
    if (!sqlInput.trim()) {
      setFeedback({ type: 'error', message: 'Digite uma consulta SQL (somente leitura).' });
      return;
    }
    try {
      setRunningSql(true);
      setFeedback(null);
      const res = await api.post('/dev/sql', { sql: sqlInput.trim() }, getDevHeaders());
      setSqlResult(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao executar consulta.' });
    } finally {
      setRunningSql(false);
    }
  };

  const handleReprocessQueue = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.post('/dev/broker/process', {}, getDevHeaders());
      setFeedback({ type: res.data?.success ? 'success' : 'error', message: `Motor reprocessado: ${res.data?.processedPresences ?? 0} presenças, ${res.data?.pingsGenerated ?? 0} pings, ${res.data?.brokersSuspended ?? 0} suspensos.` });
      loadBrokerOverview();
      loadDeadmanOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao reprocessar fila.' });
    } finally {
      setLoading(false);
    }
  };

  const handleForceDeadmanPing = async (presenceId: string) => {
    try {
      setFeedback(null);
      const res = await api.post(`/dev/deadman/${presenceId}/force-ping`, {}, getDevHeaders());
      setFeedback({ type: res.data?.success ? 'success' : 'error', message: res.data?.message || 'Ping manual disparado.' });
      loadDeadmanOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao disparar ping manual.' });
    }
  };

  const handleFinalizeAllStale = async () => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm(
      'ZERAR FILA DE PRESENÇAS?\n\nEncerra TODAS as presenças online/suspensas pendentes (zumbis), liberando novos check-ins. Nenhum registro é apagado e o tempo não é mantido. Continuar?'
    );
    if (!confirmed) return;
    try {
      setLoading(true);
      setFeedback(null);
      const res = await api.post('/dev/presences/finalize-all', { forceAll: true }, getDevHeaders());
      setFeedback({ type: 'success', message: `Fila zerada: ${res.data?.total ?? 0} presenças finalizadas.` });
      loadBrokerOverview();
      loadDeadmanOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao finalizar presenças pendentes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!devToken) return;
    if (currentTab === 'health') loadHealth();
    if (currentTab === 'tenants') loadTenants();
    if (currentTab === 'audit') loadAuditLogs();
    if (currentTab === 'db') loadDbStatus();
    if (currentTab === 'live') {
      loadLiveOverview();
      loadBoothGrid();
      if (tenants.length === 0) loadTenants();
    }
    if (currentTab === 'users') loadUsers();
    if (currentTab === 'broker') {
      loadBrokerOverview();
      if (tenants.length === 0) loadTenants();
    }
    if (currentTab === 'deadman') loadDeadmanOverview();
    if (currentTab === 'stats') {
      loadStatsHistory();
      if (tenants.length === 0) loadTenants();
    }
  }, [devToken, currentTab, loadHealth, loadTenants, loadAuditLogs, loadDbStatus, loadLiveOverview, loadUsers, loadBrokerOverview, loadDeadmanOverview, loadStatsHistory, loadBoothGrid, tenants.length]);

  useEffect(() => {
    if (!devToken || currentTab !== 'users') return;
    const delay = setTimeout(() => loadUsers(), 500);
    return () => clearTimeout(delay);
  }, [userSearch, userRoleFilter, userStatusFilter, userTenantFilter, loadUsers, devToken, currentTab]);

  // ============ AÇÕES ============

  const handleCreateTenant = async () => {
    if (!newTenantName || !newTenantSlug || !newAdminEmail || !newAdminPassword || !newAdminName || !newAdminNomeGuerra) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios (*).' });
      return;
    }
    try {
      setSavingTenant(true);
      setFeedback(null);
      const res = await api.post(
        '/dev/tenants',
        {
          name: newTenantName.trim(),
          slug: newTenantSlug.toLowerCase().trim(),
          primaryColor: newTenantColor,
          logoUrl: newTenantLogo.trim() || undefined,
          adminName: newAdminName.trim(),
          adminNomeGuerra: newAdminNomeGuerra.toUpperCase().trim(),
          adminEmail: newAdminEmail.toLowerCase().trim(),
          adminPassword: newAdminPassword,
        },
        getDevHeaders(),
      );
      setFeedback({ type: 'success', message: res.data.message || 'Tenant criado com sucesso!' });
      setShowNewTenantModal(false);
      setNewTenantName('');
      setNewTenantSlug('');
      setNewAdminName('');
      setNewAdminNomeGuerra('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      loadTenants();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Falha ao criar tenant.' });
    } finally {
      setSavingTenant(false);
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/dev/tenants/${id}/status`, { status: nextStatus }, getDevHeaders());
      loadTenants();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao alterar status.' });
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      setFeedback({ type: 'error', message: 'Informe um e-mail de destino para o teste.' });
      return;
    }
    try {
      setSendingTestEmail(true);
      setFeedback(null);
      const res = await api.post('/dev/test-email', { targetEmail: testEmailAddress.trim() }, getDevHeaders());
      setFeedback({ type: res.data.success ? 'success' : 'error', message: res.data.message });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao enviar e-mail de teste.' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setSendingTestPush(true);
      setFeedback(null);
      const res = await api.post(
        '/dev/test-push',
        {
          title: testPushTitle,
          body: testPushBody,
          scope: testPushScope,
          userId: testPushUserId.trim() || undefined,
          tenantId: testPushTenantId || undefined,
        },
        getDevHeaders(),
      );
      setFeedback({ type: res.data.success ? 'success' : 'error', message: res.data.message });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao disparar push de teste.' });
    } finally {
      setSendingTestPush(false);
    }
  };

  const openUserProfile = async (userId: string) => {
    if (!devToken) return;
    try {
      setProfileLoading(true);
      const res = await api.get(`/dev/users/${userId}/profile`, getDevHeaders());
      setSelectedUser(res.data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Falha ao carregar perfil: ' + (err.response?.data?.message || err.message) });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSetUserStatus = async (userId: string, nextStatus: string) => {
    try {
      const res = await api.patch(`/dev/users/${userId}/status`, { status: nextStatus }, getDevHeaders());
      setFeedback({ type: 'success', message: res.data?.message || 'Status atualizado.' });
      if (selectedUser?.id === userId) {
        setSelectedUser((u) => (u ? { ...u, status: nextStatus } : u));
      }
      loadUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao alterar status.' });
    }
  };

  // ==========================================
  // TELA DE AUTENTICAÇÃO COM CHAVE MESTRA
  // ==========================================
  if (!devToken) {
    return (
      <View style={styles.authContainer}>
        <ScreenCode code="DEV-AUTH" />
        <View style={styles.authCard}>
          <View style={[styles.authHeaderBadge, { backgroundColor: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)' }]}>
            <Text style={[styles.authBadgeText, { color: '#facc15' }]}>SUPERADMIN CONSOLE</Text>
          </View>
          <Text style={styles.authTitle}>ABIATAR · Painel DEV</Text>
          <Text style={styles.authDesc}>
            Área restrita de controle técnico, telemetria, banco de dados e gestão multi-tenant SaaS.
          </Text>

          {authError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Chave Mestra de Desenvolvedor *</Text>
          <TextInput
            style={styles.authInput}
            value={masterKeyInput}
            onChangeText={setMasterKeyInput}
            placeholder="Digite a master key..."
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.authButton, authLoading && { opacity: 0.7 }]}
            onPress={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.authButtonText}>Entrar no Console DEV</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={onBack}>
            <Text style={{ color: '#71717a', fontSize: 13 }}>← Voltar para o Sistema</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================
  // DASHBOARD DEV COMPLETO
  // ==========================================
  const checksList = dbStatus?.checks
    ? [
        { key: 'Índice uq_presences_broker_active', ok: !!dbStatus.checks.uq_presences_broker_active },
        { key: 'Enum de resposta valid_reception', ok: !!dbStatus.checks.valid_reception_enum },
        { key: 'Enum de status das presenças completo', ok: !!dbStatus.checks.presences_status_complete },
        { key: 'Coluna users.broker_stage', ok: !!dbStatus.checks.users_broker_stage_column },
        { key: 'Colunas attended_at / attended_by_user_id', ok: !!dbStatus.checks.presences_attended_columns },
      ]
    : [];

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'health', label: 'Telemetria' },
    { key: 'tenants', label: `Tenants (${tenants.length || 0})` },
    { key: 'audit', label: 'Auditoria' },
    { key: 'db', label: 'Banco & Migrações' },
    { key: 'live', label: 'Presenças / Booths' },
    { key: 'broker', label: 'Filas / Broker' },
    { key: 'deadman', label: 'Deadman' },
    { key: 'stats', label: 'Histórico' },
    { key: 'users', label: 'Usuários' },
    { key: 'sql', label: 'SQL Console' },
    { key: 'tools', label: 'Dev Tools' },
  ];

  return (
    <View style={styles.container}>
      <ScreenCode code="DEV-01" />

      {/* TOP HEADER */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.brandTitle}>ABIATAR DEV</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: healthData?.status === 'ONLINE' ? '#22c55e' : '#eab308' }]} />
            <Text style={styles.statusPillText}>{healthData?.status || 'ONLINE'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
            <Text style={styles.headerBtnText}>Ver PWA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { borderColor: '#ef4444' }]} onPress={handleLogoutDev}>
            <Text style={[styles.headerBtnText, { color: '#ef4444' }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS (roláveis horizontalmente) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingRight: 16 }}>
        {tabs.map((t) => {
          const active = currentTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setCurrentTab(t.key)}
            >
              <Text style={active ? styles.tabTextActive : styles.tabText}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FEEDBACK */}
      {feedback && (
        <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          <TouchableOpacity onPress={() => setFeedback(null)}>
            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 10 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ---------------- TELEMETRIA ---------------- */}
        {currentTab === 'health' && (
          <View style={{ gap: 16 }}>
            {healthData ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Banco de Dados</Text>
                    <Text style={[styles.metricValue, { color: '#4ade80' }]}>
                      {healthData.database.status === 'healthy' ? 'Saudável' : 'Erro'}
                    </Text>
                    <Text style={styles.metricSub}>Latência: {healthData.database.latencyMs} ms</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Uptime</Text>
                    <Text style={styles.metricValue}>{healthData.system.uptime}</Text>
                    <Text style={styles.metricSub}>Node {healthData.system.nodeVersion} · {healthData.system.environment}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Memória (RAM)</Text>
                    <Text style={styles.metricValue}>{healthData.system.memory.heapUsed}</Text>
                    <Text style={styles.metricSub}>Heap: {healthData.system.memory.heapTotal} | RSS: {healthData.system.memory.rss}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Check-ins hoje</Text>
                    <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{healthData.counts.presencesToday}</Text>
                    <Text style={styles.metricSub}>Presenças registradas hoje</Text>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Contadores Globais do SaaS</Text>
                    <TouchableOpacity style={styles.refreshBtn} onPress={loadHealth}>
                      <Text style={styles.refreshBtnText}>Atualizar</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.grid3}>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{healthData.counts.tenants}</Text>
                      <Text style={styles.subStatTitle}>Imobiliárias</Text>
                    </View>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{healthData.counts.users}</Text>
                      <Text style={styles.subStatTitle}>Usuários</Text>
                    </View>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{healthData.counts.booths}</Text>
                      <Text style={styles.subStatTitle}>Plantões</Text>
                    </View>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{healthData.counts.auditLogs}</Text>
                      <Text style={styles.subStatTitle}>Auditorias</Text>
                    </View>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{healthData.counts.pushTokens}</Text>
                      <Text style={styles.subStatTitle}>Push ativos</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Serviços Conectados</Text>
                  <View style={styles.grid2}>
                    <View style={styles.integrationCard}>
                      <View style={styles.rowBetween}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Resend · E-mail</Text>
                        <Text style={{ color: healthData.integrations.resend.configured ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                          {healthData.integrations.resend.status}
                        </Text>
                      </View>
                      <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                        Remetente: <Text style={{ color: '#38bdf8' }}>{healthData.integrations.resend.fromDomain}</Text>
                      </Text>
                    </View>
                    <View style={styles.integrationCard}>
                      <View style={styles.rowBetween}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Firebase FCM · Push</Text>
                        <Text style={{ color: healthData.integrations.firebase.configured ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                          {healthData.integrations.firebase.status}
                        </Text>
                      </View>
                      <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                        Tokens ativos: <Text style={{ color: '#38bdf8' }}>{healthData.integrations.firebase.registeredTokens}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando telemetria...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- TENANTS ---------------- */}
        {currentTab === 'tenants' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Imobiliárias & Construtoras</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowNewTenantModal(true)}>
                <Text style={styles.createBtnText}>+ Criar</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {tenants.map((t) => (
                <View key={t.id} style={styles.tenantCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.primary_color }} />
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{t.name}</Text>
                        <Text style={{ fontSize: 12, color: '#38bdf8' }}>slug: {t.slug}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Badge color={t.status_assinatura === 'active' ? '#22c55e' : '#ef4444'} label={t.status_assinatura.toUpperCase()} />
                      <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleTenantStatus(t.id, t.status_assinatura)}>
                        <Text style={styles.actionBtnText}>{t.status_assinatura === 'active' ? 'Suspender' : 'Ativar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.tenantStatsRow}>
                    <Text style={styles.tenantStatItem}>Corretores: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalBrokers || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>Gerentes: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalManagers || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>Plantões: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalBooths || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>Check-ins hoje: <Text style={{ color: '#4ade80', fontWeight: 'bold' }}>{t.stats?.presencesToday || 0}</Text></Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------------- AUDITORIA ---------------- */}
        {currentTab === 'audit' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Linha do Tempo de Auditoria ({auditTotal})</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadAuditLogs}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por ação, e-mail do autor, entidade..."
              placeholderTextColor="#71717a"
              value={auditSearch}
              onChangeText={(v) => {
                setAuditSearch(v);
                setAuditPage(1);
              }}
            />

            <View style={styles.auditTable}>
              {auditLogs.map((log) => (
                <View key={log.id} style={styles.auditRow}>
                  <View style={styles.rowBetween}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#38bdf8', flexShrink: 1 }}>{log.action}</Text>
                    <Text style={{ fontSize: 11, color: '#71717a' }}>{formatDate(log.created_at)}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>
                    Autor: <Text style={{ color: '#fff' }}>{log.actor_email_snapshot || 'Sistema'}</Text>{' '}
                    {log.actor_role ? `(${log.actor_role})` : ''} {!log.success ? '· falhou' : ''}
                  </Text>
                  {log.reason ? <Text style={{ fontSize: 12, color: '#eab308', marginTop: 2 }}>Motivo: {log.reason}</Text> : null}
                </View>
              ))}
              {auditLogs.length === 0 && !loading && (
                <Text style={{ padding: 16, color: '#71717a', fontSize: 13 }}>Nenhum registro encontrado.</Text>
              )}
            </View>

            <View style={styles.paginationRow}>
              <TouchableOpacity style={[styles.pageBtn, auditPage <= 1 && { opacity: 0.5 }]} disabled={auditPage <= 1} onPress={() => setAuditPage((p) => Math.max(1, p - 1))}>
                <Text style={styles.pageBtnText}>← Anterior</Text>
              </TouchableOpacity>
              <Text style={{ color: '#a1a1aa', alignSelf: 'center', fontSize: 13 }}>Página {auditPage}</Text>
              <TouchableOpacity style={[styles.pageBtn, auditLogs.length < 20 && { opacity: 0.5 }]} disabled={auditLogs.length < 20} onPress={() => setAuditPage((p) => p + 1)}>
                <Text style={styles.pageBtnText}>Próxima →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---------------- BANCO & MIGRAÇÕES ---------------- */}
        {currentTab === 'db' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Banco de Dados & Migrações</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadDbStatus}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            {dbStatus ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Tamanho do banco</Text>
                    <Text style={styles.metricValue}>{dbStatus.databaseSize?.size_pretty || '—'}</Text>
                    <Text style={styles.metricSub}>{dbStatus.databaseSize?.size_mb ?? '—'} MB</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Migrations aplicadas</Text>
                    <Text style={[styles.metricValue, { color: '#4ade80' }]}>{dbStatus.migrations.count}</Text>
                    <Text style={styles.metricSub}>Última: {dbStatus.migrations.last?.name || '—'}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Checagem</Text>
                    <Text style={[styles.metricValue, { color: checksList.every((c) => c.ok) ? '#4ade80' : '#f87171' }]}>
                      {checksList.every((c) => c.ok) ? 'OK' : `Falhas`} {checksList.filter((c) => c.ok).length}/{checksList.length}
                    </Text>
                    <Text style={styles.metricSub}>Consultado em {formatTime(dbStatus.checkedAt)}</Text>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Verificações de Schema</Text>
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {checksList.map((c) => (
                      <View key={c.key} style={styles.checkRow}>
                        <Text style={{ fontSize: 13, color: c.ok ? '#22c55e' : '#ef4444', fontWeight: '800' }}>{c.ok ? '✓' : '✗'}</Text>
                        <Text style={{ fontSize: 13, color: '#fff', flex: 1 }}>{c.key}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Contadores reais (pg_stat)</Text>
                  {dbStatus.checks?.rowCounts ? (
                    <View style={styles.grid3}>
                      {Object.entries(dbStatus.checks.rowCounts).map(([k, v]) => (
                        <View key={k} style={styles.subStatBox}>
                          <Text style={styles.subStatNum}>{Number(v)}</Text>
                          <Text style={styles.subStatTitle}>{k.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 6 }}>Tabelas (linhas vivas / mortas)</Text>
                    {dbStatus.tables.map((t) => (
                      <View key={t.table_name} style={styles.tableRow}>
                        <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{t.table_name}</Text>
                        <Text style={{ color: '#71717a', fontSize: 12 }}>{t.live_rows} vivos</Text>
                        <Text style={{ color: t.dead_rows > 0 ? '#eab308' : '#3f3f46', fontSize: 12, marginLeft: 8 }}>{t.dead_rows} mortos</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Enums</Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {Object.entries(dbStatus.enums || {}).map(([type, labels]) => (
                      <View key={type}>
                        <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '700' }}>{type}</Text>
                        <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{labels.join(', ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Índices da aplicação</Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {dbStatus.indexes.map((idx) => (
                      <View key={idx.indexname} style={{ borderBottomWidth: 1, borderBottomColor: '#1e1e24', paddingVertical: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{idx.indexname}</Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>em {idx.tablename}</Text>
                        <Text style={{ color: '#3f3f46', fontSize: 10 }} numberOfLines={1}>{idx.indexdef}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Migrations aplicadas</Text>
                  <View style={{ gap: 6, marginTop: 8 }}>
                    {[...dbStatus.migrations.applied].reverse().map((m) => (
                      <View key={m.id} style={styles.tableRow}>
                        <Text style={{ color: '#71717a', fontSize: 12, width: 30 }}>#{m.id}</Text>
                        <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{m.name}</Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>{formatDate(new Date(Number(m.applied_at_ms)))}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando estado do banco...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- PRESENÇAS / BOOTHS ---------------- */}
        {currentTab === 'live' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Diagnóstico ao Vivo</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadLiveOverview}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              <TouchableOpacity style={[styles.filterChip, liveTenantFilter === '' && styles.filterChipActive]} onPress={() => setLiveTenantFilter('')}>
                <Text style={liveTenantFilter === '' ? styles.filterChipTextActive : styles.filterChipText}>Todos</Text>
              </TouchableOpacity>
              {tenants.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.filterChip, liveTenantFilter === t.id && styles.filterChipActive]}
                  onPress={() => setLiveTenantFilter(t.id === liveTenantFilter ? '' : t.id)}
                >
                  <Text style={liveTenantFilter === t.id ? styles.filterChipTextActive : styles.filterChipText}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {liveData ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Corretores on-line</Text>
                    <Text style={[styles.metricValue, { color: '#22c55e' }]}>{liveData.overall.totalOnline}</Text>
                    <Text style={styles.metricSub}>Presenças ativas agora</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Ausentes (revalidar)</Text>
                    <Text style={[styles.metricValue, { color: '#f97316' }]}>{liveData.overall.awaitingRevalidation}</Text>
                    <Text style={styles.metricSub}>Aguardando recepção</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Pings pendentes</Text>
                    <Text style={[styles.metricValue, { color: '#eab308' }]}>{liveData.overall.pendingPings}</Text>
                    <Text style={styles.metricSub}>Deadman aguardando resposta</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Check-ins hoje</Text>
                    <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{liveData.overall.todayCheckins}</Text>
                    <Text style={styles.metricSub}>Iniciados hoje</Text>
                  </View>
                </View>

                {Object.keys(liveData.statusBreakdownToday || {}).length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Presenças de hoje por status</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {Object.entries(liveData.statusBreakdownToday).map(([status, count]) => (
                        <Badge key={status} color="#38bdf8" label={PRESENCE_STATUS_LABELS[status] || status} />
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Plantões</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {liveData.booths.map((b) => (
                      <View key={b.boothId} style={{ borderBottomWidth: 1, borderBottomColor: '#1e1e24', paddingVertical: 10 }}>
                        <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setExpandedBooth(expandedBooth === b.boothId ? null : b.boothId)}>
                          <View style={{ flexShrink: 1 }}>
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{b.boothName}</Text>
                            <Text style={{ color: '#71717a', fontSize: 11 }}>{b.tenantName} · {b.lifecycleStatus}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Badge color={b.onlineCount > 0 ? '#22c55e' : '#3f3f46'} label={`${b.onlineCount} on-line`} />
                            <Badge color={b.awaitingRevalidation > 0 ? '#f97316' : '#3f3f46'} label={`${b.awaitingRevalidation} ausentes`} />
                            <Text style={{ color: '#a1a1aa', fontSize: 12, alignSelf: 'center' }}>hoje: {b.todayCheckins}</Text>
                          </View>
                        </TouchableOpacity>
                        {expandedBooth === b.boothId && (
                          <View style={{ marginTop: 8, paddingLeft: 12 }}>
                            {b.onlineBrokers.length === 0 ? (
                              <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhum corretor on-line neste plantão.</Text>
                            ) : (
                              b.onlineBrokers.map((o) => (
                                <View key={o.presenceId} style={styles.tableRow}>
                                  <Text style={{ color: '#fff', fontSize: 13 }}>{o.nomeGuerra}</Text>
                                  <Text style={{ color: '#38bdf8', fontSize: 12, marginLeft: 8 }}>
                                    {o.roletaName || '—'} {o.roletaPosition != null ? `· pos ${o.roletaPosition}` : ''}
                                  </Text>
                                  <Text style={{ color: '#71717a', fontSize: 11, marginLeft: 8 }}>check-in {formatTime(o.checkInAt)}</Text>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Grade de Plantões · Cobertura & Regras</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {gridData.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhum plantão na grade.</Text>
                    ) : (
                      gridData.map((b) => (
                        <View key={b.boothId} style={{ borderBottomWidth: 1, borderBottomColor: '#1e1e24', paddingVertical: 10 }}>
                          <View style={styles.rowBetween}>
                            <View style={{ flexShrink: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{b.boothName}</Text>
                              <Text style={{ color: '#71717a', fontSize: 11 }}>
                                {b.tenantName} · {b.lifecycleStatus} · Wi-Fi {b.wifiCount} · raio {b.gpsRadius}m
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <Badge color={b.coverageOk ? '#22c55e' : '#ef4444'} label={b.coverageOk ? 'COBERTO' : `FALTAM ${b.coverageGap}`} />
                              <Badge color="#38bdf8" label={`${b.onlineCount}/${b.minBrokersRequired} min`} />
                              <Badge color={b.pendingPingCount > 0 ? '#eab308' : '#3f3f46'} label={`${b.pendingPingCount} pings`} />
                            </View>
                          </View>
                          {b.roletaSchedule && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                              <Text style={{ color: '#a1a1aa', fontSize: 11 }}>Roletas: {[b.roletaSchedule.roleta1, b.roletaSchedule.roleta2, b.roletaSchedule.roleta3].filter(Boolean).join(', ') || '—'} {b.roletaSchedule.weekend ? `(fim de semana ${b.roletaSchedule.weekend})` : ''}</Text>
                              <Text style={{ color: '#a1a1aa', fontSize: 11 }}>Ping: {b.roletaSchedule.pingIntervalMinutes}min · prazo {b.roletaSchedule.pingDeadlineMinutes}min</Text>
                              <Text style={{ color: '#71717a', fontSize: 11 }}>v{Number(b.ruleVersion) || 0}</Text>
                            </View>
                          )}
                          {b.lastCheckInAt ? (
                            <Text style={{ color: '#3f3f46', fontSize: 11, marginTop: 4 }}>Último check-in: {formatDate(b.lastCheckInAt)} · hoje: {b.todayCheckins}</Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Logs do Deadman (últimos)</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {liveData.deadmanRecent.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhum ping registrado ainda.</Text>
                    ) : (
                      liveData.deadmanRecent.map((d) => (
                        <View key={d.id} style={styles.tableRow}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DEADMAN_STATUS_COLOR[d.responseStatus] || '#71717a' }} />
                          <Text style={{ color: '#fff', fontSize: 13, marginLeft: 6, flex: 1 }}>{d.nomeGuerra}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 11, flex: 1.2 }}>{d.boothName} · {d.tenantName}</Text>
                          <Text style={{ color: DEADMAN_STATUS_COLOR[d.responseStatus] || '#a1a1aa', fontSize: 11 }}>
                            {d.responseStatus.replace(/_/g, ' ')} · {formatTime(d.sentAt)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando dados ao vivo...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- USUÁRIOS ---------------- */}
        {currentTab === 'users' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>
                Usuários ({usersPayload?.total ?? 0})
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadUsers}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, nome de guerra ou e-mail..."
              placeholderTextColor="#71717a"
              value={userSearch}
              onChangeText={(v) => {
                setUserSearch(v);
                setUserPage(1);
              }}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={[styles.filterChip, userRoleFilter === '' && styles.filterChipActive]} onPress={() => { setUserRoleFilter(''); setUserPage(1); }}>
                <Text style={userRoleFilter === '' ? styles.filterChipTextActive : styles.filterChipText}>Todos os papéis</Text>
              </TouchableOpacity>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterChip, userRoleFilter === value && styles.filterChipActive]}
                  onPress={() => { setUserRoleFilter(userRoleFilter === value ? '' : value); setUserPage(1); }}
                >
                  <Text style={userRoleFilter === value ? styles.filterChipTextActive : styles.filterChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={[styles.filterChip, userStatusFilter === '' && styles.filterChipActive]} onPress={() => { setUserStatusFilter(''); setUserPage(1); }}>
                <Text style={userStatusFilter === '' ? styles.filterChipTextActive : styles.filterChipText}>Todos os status</Text>
              </TouchableOpacity>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterChip, userStatusFilter === value && styles.filterChipActive]}
                  onPress={() => { setUserStatusFilter(userStatusFilter === value ? '' : value); setUserPage(1); }}
                >
                  <Text style={userStatusFilter === value ? styles.filterChipTextActive : styles.filterChipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ gap: 10 }}>
              {(usersPayload?.users || []).map((u) => (
                <View key={u.id} style={styles.tenantCard}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{u.nome_guerra}</Text>
                      <Text style={{ fontSize: 12, color: '#a1a1aa' }}>{u.name}</Text>
                      <Text style={{ fontSize: 12, color: '#38bdf8' }}>{u.email}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
                      <Badge color="#38bdf8" label={ROLE_LABELS[u.role] || u.role} />
                      <Badge color={u.status === 'active' ? '#22c55e' : u.status === 'inactive' ? '#ef4444' : '#eab308'} label={STATUS_LABELS[u.status] || u.status} />
                    </View>
                  </View>

                  <View style={styles.tenantStatsRow}>
                    <Text style={styles.tenantStatItem}>Tenant: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.tenantName}</Text></Text>
                    <Text style={styles.tenantStatItem}>Hoje: <Text style={{ color: '#4ade80', fontWeight: 'bold' }}>{u.presencesToday}</Text></Text>
                    {u.last_checkin_at ? <Text style={styles.tenantStatItem}>Último check-in: <Text style={{ color: '#fff' }}>{formatDate(u.last_checkin_at)}</Text></Text> : null}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openUserProfile(u.id)}>
                      <Text style={styles.actionBtnText}>Ver perfil</Text>
                    </TouchableOpacity>
                    {u.status !== 'active' && (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: '#22c55e' }]} onPress={() => handleSetUserStatus(u.id, 'active')}>
                        <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>Ativar</Text>
                      </TouchableOpacity>
                    )}
                    {u.status === 'active' && (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: '#ef4444' }]} onPress={() => handleSetUserStatus(u.id, 'inactive')}>
                        <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Desativar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {!usersPayload && loading && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#38bdf8" />
                </View>
              )}
              {usersPayload && usersPayload.users.length === 0 && (
                <Text style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum usuário encontrado.</Text>
              )}
            </View>

            {usersPayload && usersPayload.total > usersPayload.limit && (
              <View style={styles.paginationRow}>
                <TouchableOpacity style={[styles.pageBtn, userPage <= 1 && { opacity: 0.5 }]} disabled={userPage <= 1} onPress={() => setUserPage((p) => Math.max(1, p - 1))}>
                  <Text style={styles.pageBtnText}>← Anterior</Text>
                </TouchableOpacity>
                <Text style={{ color: '#a1a1aa', alignSelf: 'center', fontSize: 13 }}>Página {userPage}</Text>
                <TouchableOpacity style={[styles.pageBtn, (usersPayload?.users?.length || 0) < (usersPayload?.limit || 15) && { opacity: 0.5 }]} disabled={(usersPayload?.users?.length || 0) < (usersPayload?.limit || 15)} onPress={() => setUserPage((p) => p + 1)}>
                  <Text style={styles.pageBtnText}>Próxima →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ---------------- FILAS / BROKER ---------------- */}
        {currentTab === 'broker' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Filas & Broker em Tempo Real</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadBrokerOverview}>
                  <Text style={styles.refreshBtnText}>Atualizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createBtn} onPress={handleReprocessQueue} disabled={loading}>
                  <Text style={styles.createBtnText}>{loading ? 'Processando...' : 'Reprocessar Motor'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.createBtn, { backgroundColor: '#dc2626' }]} onPress={handleFinalizeAllStale} disabled={loading}>
                  <Text style={styles.createBtnText}>{loading ? 'Finalizando...' : 'Zerar Fila / Finalizar Suspensos'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {brokerData ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Corretores on-line</Text>
                    <Text style={[styles.metricValue, { color: '#22c55e' }]}>{brokerData.overall.onlineTotal}</Text>
                    <Text style={styles.metricSub}>Em plantão agora</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Aguardando revalidar</Text>
                    <Text style={[styles.metricValue, { color: '#f97316' }]}>{brokerData.overall.awaitingRevalidation}</Text>
                    <Text style={styles.metricSub}>Ausentes pós-ticket</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Aguardando sorteio</Text>
                    <Text style={[styles.metricValue, { color: '#eab308' }]}>{brokerData.overall.waitingDraw}</Text>
                    <Text style={styles.metricSub}>Sem posição na roleta</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Na fila (posição)</Text>
                    <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{brokerData.overall.inQueue}</Text>
                    <Text style={styles.metricSub}>Com posição definida</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Pings pendentes</Text>
                    <Text style={[styles.metricValue, { color: '#ef4444' }]}>{brokerData.overall.pendingPingsTotal}</Text>
                    <Text style={styles.metricSub}>Deadman aguardando</Text>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Filas por Plantão</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {brokerData.byBooth.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhum plantão cadastrado.</Text>
                    ) : (
                      brokerData.byBooth.map((b) => (
                        <View key={b.boothId} style={{ borderBottomWidth: 1, borderBottomColor: '#1e1e24', paddingVertical: 10 }}>
                          <View style={styles.rowBetween}>
                            <View style={{ flexShrink: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{b.boothName}</Text>
                              <Text style={{ color: '#71717a', fontSize: 11 }}>{b.tenantName} · {b.lifecycleStatus}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <Badge color={b.coverageOk ? '#22c55e' : '#ef4444'} label={b.coverageOk ? 'COBERTO' : `FALTA ${b.coverageGap}`} />
                              <Badge color="#38bdf8" label={`${b.onlineCount} on`} />
                              <Badge color={b.pendingPingCount > 0 ? '#eab308' : '#3f3f46'} label={`${b.pendingPingCount} pings`} />
                            </View>
                          </View>
                          {b.roletas.length === 0 ? (
                            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 8 }}>Nenhum corretor na roleta agora.</Text>
                          ) : (
                            b.roletas.map((r) => (
                              <View key={r.roletaName} style={{ marginTop: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#27272a' }}>
                                <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '700' }}>
                                  {r.roletaName} · {r.positions.length} na fila{r.waitingDraw > 0 ? ` · ${r.waitingDraw} aguardando sorteio` : ''}
                                </Text>
                                {r.positions.map((p) => (
                                  <View key={p.presenceId} style={styles.tableRow}>
                                    <Text style={{ color: '#fff', fontSize: 12, width: 26 }}>#{p.roletaPosition ?? '—'}</Text>
                                    <Text style={{ color: '#fff', fontSize: 12, flex: 1 }}>{p.nomeGuerra}</Text>
                                    <Text style={{ color: p.hasPendingPing ? '#eab308' : '#71717a', fontSize: 11, marginRight: 8 }}>
                                      {p.minutesActive} min{p.hasPendingPing ? ' · ping!' : ''}
                                    </Text>
                                    <Text style={{ color: '#71717a', fontSize: 11 }}>check {formatTime(p.checkInAt)}</Text>
                                  </View>
                                ))}
                              </View>
                            ))
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Pings pendentes do Deadman</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {brokerData.pendingPings.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhum ping pendente.</Text>
                    ) : (
                      brokerData.pendingPings.map((p) => (
                        <View key={p.id} style={styles.tableRow}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.overdue ? '#ef4444' : '#eab308' }} />
                          <Text style={{ color: '#fff', fontSize: 13, marginLeft: 6, flex: 1 }}>{p.nomeGuerra}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 11, flex: 1.2 }}>{p.boothName}</Text>
                          <Text style={{ color: p.overdue ? '#ef4444' : '#eab308', fontSize: 11 }}>
                            {p.minutesSince}min / {p.deadlineMinutes}min {p.overdue ? '· ATRASADO' : ''}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando filas e broker...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- DEADMAN ---------------- */}
        {currentTab === 'deadman' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Monitor do Dead Man's Switch</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadDeadmanOverview}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            {deadmanData ? (
              <>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Presenças on-line</Text>
                    <Text style={[styles.metricValue, { color: '#22c55e' }]}>{deadmanData.summary.totalOnline}</Text>
                    <Text style={styles.metricSub}>Sendo monitoradas</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Pings pendentes</Text>
                    <Text style={[styles.metricValue, { color: '#eab308' }]}>{deadmanData.summary.pending}</Text>
                    <Text style={styles.metricSub}>Aguardando resposta</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Atrasados</Text>
                    <Text style={[styles.metricValue, { color: '#ef4444' }]}>{deadmanData.summary.overdue}</Text>
                    <Text style={styles.metricSub}>Acima do prazo</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Prestes a pingar</Text>
                    <Text style={[styles.metricValue, { color: '#f97316' }]}>{deadmanData.summary.aboutToPing}</Text>
                    <Text style={styles.metricSub}>Vencendo agora</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Suspensos hoje</Text>
                    <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{deadmanData.summary.suspendedToday}</Text>
                    <Text style={styles.metricSub}>Sem resposta / fora da área</Text>
                  </View>
                </View>

                {Object.keys(deadmanData.status24h).length > 0 && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Respostas nas últimas 24h</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {Object.entries(deadmanData.status24h).map(([status, count]) => (
                        <Badge key={status} color={DEADMAN_STATUS_COLOR[status] || '#a1a1aa'} label={`${status.replace(/_/g, ' ')}: ${count}`} />
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Pings pendentes ({deadmanData.pendingPings.length})</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {deadmanData.pendingPings.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Tudo em dia — nenhum ping pendente.</Text>
                    ) : (
                      deadmanData.pendingPings.map((p) => (
                        <View key={p.id} style={[styles.tableRow, { justifyContent: 'space-between' }]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.overdue ? '#ef4444' : '#eab308' }} />
                              <Text style={{ color: '#fff', fontSize: 13, marginLeft: 6 }}>{p.nomeGuerra}</Text>
                            </View>
                            <Text style={{ color: '#a1a1aa', fontSize: 11, marginTop: 2 }}>
                              {p.boothName} · {p.tenantName} · enviado {formatTime(p.sentAt)}
                            </Text>
                            <Text style={{ color: p.overdue ? '#ef4444' : '#eab308', fontSize: 11 }}>
                              {p.minutesSince}min sem resposta (prazo {p.deadlineMinutes}min)
                            </Text>
                          </View>
                          <TouchableOpacity style={styles.actionBtn} onPress={() => handleForceDeadmanPing(p.presenceId)}>
                            <Text style={styles.actionBtnText}>Reenviar ping</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Prestes a pingar ({deadmanData.aboutToPing.length})</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {deadmanData.aboutToPing.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhuma presença vencida neste momento.</Text>
                    ) : (
                      deadmanData.aboutToPing.map((p) => (
                        <View key={p.presenceId} style={styles.tableRow}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
                          <Text style={{ color: '#fff', fontSize: 13, marginLeft: 6, flex: 1 }}>{p.nomeGuerra}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 11, flex: 1.2 }}>{p.boothName} · {p.tenantName}</Text>
                          <Text style={{ color: '#f97316', fontSize: 11 }}>próx. ping {formatTime(p.nextConfirmationAt)}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando monitor deadman...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- HISTÓRICO ---------------- */}
        {currentTab === 'stats' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Histórico e Métricas ({statsData?.days ?? statsDays} dias)</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadStatsHistory}>
                <Text style={styles.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[7, 14, 30, 60].map((d) => (
                <TouchableOpacity key={d} style={[styles.filterChip, statsDays === d && styles.filterChipActive]} onPress={() => setStatsDays(d)}>
                  <Text style={statsDays === d ? styles.filterChipTextActive : styles.filterChipText}>{d} dias</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.filterChip, statsTenantFilter === '' && styles.filterChipActive]} onPress={() => setStatsTenantFilter('')}>
                <Text style={statsTenantFilter === '' ? styles.filterChipTextActive : styles.filterChipText}>Todos</Text>
              </TouchableOpacity>
              {tenants.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.filterChip, statsTenantFilter === t.id && styles.filterChipActive]}
                  onPress={() => setStatsTenantFilter(statsTenantFilter === t.id ? '' : t.id)}
                >
                  <Text style={statsTenantFilter === t.id ? styles.filterChipTextActive : styles.filterChipText}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {statsData ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Presenças por dia</Text>
                  {(() => {
                    const max = Math.max(1, ...statsData.perDay.map((d) => d.total));
                    return (
                      <View style={{ marginTop: 12, gap: 6 }}>
                        {statsData.perDay.map((d) => (
                          <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#71717a', fontSize: 11, width: 78 }}>{formatDate(d.date + 'T12:00:00')}</Text>
                            <View style={{ flex: 1, height: 18, backgroundColor: '#18181c', borderRadius: 4, overflow: 'hidden' }}>
                              <View style={{ width: `${(d.total / max) * 100}%`, height: '100%', backgroundColor: d.total > 0 ? '#38bdf8' : '#27272a', borderRadius: 4 }} />
                            </View>
                            <Text style={{ color: '#fff', fontSize: 12, width: 60, textAlign: 'right' }}>
                              {d.total > 0 ? `${d.total} (${d.online || 0} on)` : '—'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Hoje · {statsData.today.total} presenças</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {Object.entries(statsData.today.byStatus).length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhuma presença registrada hoje ainda.</Text>
                    ) : (
                      Object.entries(statsData.today.byStatus).map(([status, count]) => (
                        <Badge key={status} color="#38bdf8" label={`${PRESENCE_STATUS_LABELS[status] || status}: ${count}`} />
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Top corretores hoje</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {statsData.topBrokersToday.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Sem dados hoje.</Text>
                    ) : (
                      statsData.topBrokersToday.map((b, i) => (
                        <View key={`${b.email}-${i}`} style={styles.tableRow}>
                          <Text style={{ color: '#71717a', fontSize: 12, width: 24 }}>#{i + 1}</Text>
                          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{b.nome_guerra}</Text>
                          <Text style={{ color: '#a1a1aa', fontSize: 11, flex: 1.1 }}>{b.tenant_name}</Text>
                          <Text style={{ color: '#38bdf8', fontSize: 12 }}>{b.checkins} check-ins</Text>
                          <Text style={{ color: '#71717a', fontSize: 11, marginLeft: 8 }}>{Number(b.minutes_sum)}min</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Movimentação por plantão (hoje)</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {statsData.boothCheckinsToday.length === 0 ? (
                      <Text style={{ color: '#71717a', fontSize: 12 }}>Sem check-ins hoje.</Text>
                    ) : (
                      statsData.boothCheckinsToday.map((b) => (
                        <View key={b.booth_id} style={styles.tableRow}>
                          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }}>{b.booth_name}</Text>
                          <Badge color={b.lifecycle_status === 'published' ? '#22c55e' : '#eab308'} label={b.lifecycle_status} />
                          <Text style={{ color: '#38bdf8', fontSize: 12, marginLeft: 8 }}>{b.checkins} check-ins</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando histórico...</Text>
              </View>
            )}
          </View>
        )}

        {/* ---------------- SQL CONSOLE ---------------- */}
        {currentTab === 'sql' && (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Console SQL somente leitura</Text>
              <TouchableOpacity style={styles.createBtn} onPress={handleRunSql} disabled={runningSql}>
                <Text style={styles.createBtnText}>{runningSql ? 'Executando...' : 'Executar'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: '#71717a' }}>
              Apenas SELECT / WITH / SHOW / VALUES / EXPLAIN. Comandos de escrita são bloqueados; limite de 500 linhas e timeout de 5s.
            </Text>
            <TextInput
              style={styles.sqlInput}
              multiline
              numberOfLines={6}
              placeholder="SELECT t.name, COUNT(u.id) AS users FROM tenants t LEFT JOIN users u ON u.tenant_id = t.id GROUP BY t.name"
              placeholderTextColor="#3f3f46"
              value={sqlInput}
              onChangeText={setSqlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {sqlResult ? (
              <View style={styles.sectionCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Resultado</Text>
                  <Text style={{ color: '#38bdf8', fontSize: 12 }}>
                    {sqlResult.rowCount} linha(s) · {sqlResult.durationMs}ms{sqlResult.truncated ? ' · truncado' : ''}
                  </Text>
                </View>
                {sqlResult.columns.length === 0 ? (
                  <Text style={{ color: '#71717a', fontSize: 12, marginTop: 8 }}>A consulta não retornou colunas.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    <View>
                      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 6 }}>
                        {sqlResult.columns.map((c) => (
                          <Text key={c} style={{ color: '#38bdf8', fontSize: 12, fontWeight: '800', width: 160 }}>{c}</Text>
                        ))}
                      </View>
                      {sqlResult.rows.map((row, i) => (
                        <View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#18181c' }}>
                          {sqlResult.columns.map((c) => {
                            const v = row[c];
                            const str = v === null || v === undefined ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v);
                            return (
                              <Text key={c} style={{ color: v === null || v === undefined ? '#3f3f46' : '#fff', fontSize: 12, width: 160 }} numberOfLines={2}>
                                {str}
                              </Text>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            ) : null}
          </View>
        )}

        {/* ---------------- DEV TOOLS ---------------- */}
        {currentTab === 'tools' && (
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>Ferramentas Rápidas de Diagnóstico</Text>

            <View style={styles.sectionCard}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                Disparo de E-mail de Diagnóstico (Resend)
              </Text>
              <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 12 }}>
                Envia um e-mail com layout oficial para testar a entrega na caixa postal.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="Digite seu e-mail para receber o teste..."
                  placeholderTextColor="#71717a"
                  value={testEmailAddress}
                  onChangeText={setTestEmailAddress}
                />
                <TouchableOpacity style={[styles.createBtn, sendingTestEmail && { opacity: 0.7 }]} onPress={handleSendTestEmail} disabled={sendingTestEmail}>
                  <Text style={styles.createBtnText}>{sendingTestEmail ? 'Enviando...' : 'Enviar'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                Disparo de Notificação Push (Firebase FCM)
              </Text>
              <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 12 }}>
                Dispara um push por segmento: primeiros 5 dispositivos, todos, usuário específico e/ou tenant.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity style={[styles.filterChip, testPushScope === 'first5' && styles.filterChipActive]} onPress={() => setTestPushScope('first5')}>
                  <Text style={testPushScope === 'first5' ? styles.filterChipTextActive : styles.filterChipText}>Primeiros 5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, testPushScope === 'all' && styles.filterChipActive]} onPress={() => setTestPushScope('all')}>
                  <Text style={testPushScope === 'all' ? styles.filterChipTextActive : styles.filterChipText}>Todos</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.searchInput, { marginBottom: 8 }]}
                placeholder="Título da notificação..."
                placeholderTextColor="#71717a"
                value={testPushTitle}
                onChangeText={setTestPushTitle}
              />
              <TextInput
                style={[styles.searchInput, { marginBottom: 8 }]}
                placeholder="Corpo da mensagem..."
                placeholderTextColor="#71717a"
                value={testPushBody}
                onChangeText={setTestPushBody}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="ID do usuário (opcional)"
                  placeholderTextColor="#71717a"
                  value={testPushUserId}
                  onChangeText={setTestPushUserId}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.searchInput, { flex: 1 }]}
                  placeholder="ID do tenant (opcional)"
                  placeholderTextColor="#71717a"
                  value={testPushTenantId}
                  onChangeText={setTestPushTenantId}
                  autoCapitalize="none"
                />
              </View>
              <Text style={{ fontSize: 11, color: '#3f3f46', marginBottom: 10 }}>
                Sem filtros → segmento completo. Com tenantId → somente aquele tenant. Com userId → somente aquele usuário.
              </Text>
              <TouchableOpacity style={[styles.createBtn, { alignSelf: 'flex-start' }, sendingTestPush && { opacity: 0.7 }]} onPress={handleSendTestPush} disabled={sendingTestPush}>
                <Text style={styles.createBtnText}>{sendingTestPush ? 'Disparando...' : 'Disparar Push'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------------- MODAL: CRIAR TENANT ---------------- */}
      <Modal visible={showNewTenantModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
              Criar Nova Imobiliária / Construtora
            </Text>
            <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 14 }}>
              Configuração rápida de tenant SaaS e criação do primeiro Diretor Master.
            </Text>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Nome da Empresa *</Text>
              <TextInput style={styles.modalInput} placeholder="Ex: Cury Vendas" placeholderTextColor="#71717a" value={newTenantName} onChangeText={setNewTenantName} />

              <Text style={styles.inputLabel}>Subdomínio / Slug *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: cury (letras minúsculas e hífens)"
                placeholderTextColor="#71717a"
                value={newTenantSlug}
                onChangeText={(v) => setNewTenantSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Cor Primária (Hex)</Text>
              <TextInput style={styles.modalInput} placeholder="#E31C1C" placeholderTextColor="#71717a" value={newTenantColor} onChangeText={setNewTenantColor} />

              <Text style={styles.inputLabel}>Logo URL (opcional)</Text>
              <TextInput style={styles.modalInput} placeholder="https://..." placeholderTextColor="#71717a" value={newTenantLogo} onChangeText={setNewTenantLogo} autoCapitalize="none" />

              <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: 12 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#38bdf8', marginBottom: 8 }}>
                Administrador Inicial (Diretoria Level 1)
              </Text>

              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput style={styles.modalInput} placeholder="Ex: Carlos Diretor" placeholderTextColor="#71717a" value={newAdminName} onChangeText={setNewAdminName} />

              <Text style={styles.inputLabel}>Nome de Guerra *</Text>
              <TextInput style={styles.modalInput} placeholder="Ex: CARLOS" placeholderTextColor="#71717a" value={newAdminNomeGuerra} onChangeText={(v) => setNewAdminNomeGuerra(v.toUpperCase())} autoCapitalize="characters" />

              <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
              <TextInput style={styles.modalInput} placeholder="Ex: diretor@empresa.com.br" placeholderTextColor="#71717a" value={newAdminEmail} onChangeText={setNewAdminEmail} autoCapitalize="none" />

              <Text style={styles.inputLabel}>Senha Inicial *</Text>
              <TextInput style={styles.modalInput} placeholder="Mínimo 6 caracteres..." placeholderTextColor="#71717a" value={newAdminPassword} onChangeText={setNewAdminPassword} secureTextEntry />
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewTenantModal(false)} disabled={savingTenant}>
                <Text style={{ color: '#a1a1aa', fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createBtn, savingTenant && { opacity: 0.7 }]} onPress={handleCreateTenant} disabled={savingTenant}>
                <Text style={styles.createBtnText}>{savingTenant ? 'Criando...' : 'Salvar e Ativar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- MODAL: PERFIL DO USUÁRIO ---------------- */}
      <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 560 }]}>
            {profileLoading && !selectedUser ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#38bdf8" />
              </View>
            ) : selectedUser ? (
              <>
                <ScrollView style={{ maxHeight: 520 }}>
                  <View style={styles.rowBetween}>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{selectedUser.nome_guerra}</Text>
                      <Text style={{ fontSize: 13, color: '#a1a1aa' }}>{selectedUser.name}</Text>
                      <Text style={{ fontSize: 12, color: '#38bdf8' }}>{selectedUser.email}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Badge color="#38bdf8" label={ROLE_LABELS[selectedUser.role] || selectedUser.role} />
                      <Badge color={selectedUser.status === 'active' ? '#22c55e' : selectedUser.status === 'inactive' ? '#ef4444' : '#eab308'} label={STATUS_LABELS[selectedUser.status] || selectedUser.status} />
                    </View>
                  </View>

                  {selectedUser.tenant && (
                    <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 6 }}>
                      Tenant: <Text style={{ color: '#fff' }}>{selectedUser.tenant.name}</Text> ({selectedUser.tenant.slug})
                    </Text>
                  )}

                  <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: 12 }} />

                  <View style={styles.grid3}>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{selectedUser.presences.total}</Text>
                      <Text style={styles.subStatTitle}>Presenças total</Text>
                    </View>
                    <View style={styles.subStatBox}>
                      <Text style={styles.subStatNum}>{selectedUser.presences.today}</Text>
                      <Text style={styles.subStatTitle}>Hoje</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {Object.entries(selectedUser.presences.byStatus).map(([status, count]) => (
                      <Badge key={status} color="#38bdf8" label={`${PRESENCE_STATUS_LABELS[status] || status}: ${count}`} />
                    ))}
                  </View>

                  <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 }}>Últimas presenças</Text>
                  {selectedUser.recentPresences.length === 0 ? (
                    <Text style={{ color: '#71717a', fontSize: 12 }}>Nenhuma presença registrada.</Text>
                  ) : (
                    selectedUser.recentPresences.map((p) => (
                      <View key={p.id} style={styles.tableRow}>
                        <Badge color={p.status === 'online' ? '#22c55e' : p.status === 'completed' ? '#38bdf8' : '#f97316'} label={PRESENCE_STATUS_LABELS[p.status] || p.status} />
                        <Text style={{ color: '#fff', fontSize: 12, marginLeft: 8, flex: 1 }}>{p.boothName}</Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>
                          {p.checkInAt ? formatTime(p.checkInAt) : '—'}
                          {p.attendedAt ? ` · atend. ${formatTime(p.attendedAt)}` : ''}
                        </Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {selectedUser.status === 'active' ? (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: '#ef4444' }]} onPress={() => handleSetUserStatus(selectedUser.id, 'inactive')}>
                        <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Desativar usuário</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: '#22c55e' }]} onPress={() => handleSetUserStatus(selectedUser.id, 'active')}>
                        <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>Ativar usuário</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedUser(null)}>
                    <Text style={{ color: '#a1a1aa', fontWeight: 'bold' }}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ========================= ESTILOS =========================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  topBar: {
    backgroundColor: '#121215',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181c',
  },
  headerBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  tabBar: {
    flexGrow: 0,
    backgroundColor: '#121215',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#38bdf8' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#71717a' },
  tabTextActive: { fontSize: 13, fontWeight: '700', color: '#38bdf8' },
  scrollContent: { padding: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 16,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#71717a',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 },
  metricSub: { fontSize: 11, color: '#a1a1aa' },
  sectionCard: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  subStatBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  subStatNum: { fontSize: 24, fontWeight: '900', color: '#38bdf8', marginBottom: 2 },
  subStatTitle: { fontSize: 11, color: '#a1a1aa', textAlign: 'center', textTransform: 'capitalize' },
  integrationCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 14,
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  refreshBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  createBtn: { backgroundColor: '#38bdf8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  createBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  tenantCard: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  tenantStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e1e24',
  },
  tenantStatItem: { fontSize: 12, color: '#a1a1aa' },
  searchInput: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#fff',
  },
  sqlInput: {
    backgroundColor: '#08080a',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#38bdf8',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  auditTable: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    overflow: 'hidden',
  },
  auditRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e24',
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  pageBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 },
  feedbackBanner: {
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackSuccess: { backgroundColor: '#15803d' },
  feedbackError: { backgroundColor: '#b91c1c' },
  feedbackText: { fontSize: 13, fontWeight: '700', color: '#fff', flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterChipActive: { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#a1a1aa' },
  filterChipTextActive: { fontSize: 12, fontWeight: '700', color: '#38bdf8' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 20,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#a1a1aa', marginBottom: 4, marginTop: 8 },
  modalInput: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#fff',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 28,
  },
  authHeaderBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
    borderWidth: 1,
  },
  authBadgeText: { fontSize: 10, fontWeight: '800' },
  authTitle: { fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 6 },
  authDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 18, marginBottom: 20 },
  authInput: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#38bdf8',
    marginBottom: 16,
  },
  authButton: {
    backgroundColor: '#ffffff',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authButtonText: { color: '#000000', fontWeight: '800', fontSize: 14 },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  errorText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
});