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

interface HealthData {
  status: string;
  checkedAt: string;
  executionDurationMs: number;
  database: {
    status: string;
    latencyMs: number;
    provider: string;
  };
  system: {
    nodeVersion: string;
    environment: string;
    uptime: string;
    memory: {
      rss: string;
      heapUsed: string;
      heapTotal: string;
    };
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
    resend: {
      configured: boolean;
      fromDomain: string;
      status: string;
    };
    firebase: {
      configured: boolean;
      registeredTokens: number;
      status: string;
    };
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

  const [currentTab, setCurrentTab] = useState<'health' | 'tenants' | 'audit' | 'tools'>('health');
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Novo Tenant
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

  // Ferramentas de Teste
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testPushTitle, setTestPushTitle] = useState('?? Teste de Notifica��o DEV');
  const [testPushBody, setTestPushBody] = useState('Mensagem de telemetria enviada pelo SuperAdmin.');
  const [sendingTestPush, setSendingTestPush] = useState(false);

  // Autentica��o com Chave Mestra
  const handleAuth = async () => {
    if (!masterKeyInput.trim()) {
      setAuthError('Por favor, informe a chave mestra de desenvolvedor.');
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
      setAuthError(err.response?.data?.message || 'Chave mestra inv�lida.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutDev = () => {
    setDevToken(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('@abiatar:dev_token');
    }
  };

  // Helper para chamadas com token Dev
  const getDevHeaders = useCallback(() => {
    return {
      headers: { Authorization: `Bearer ${devToken}` },
    };
  }, [devToken]);

  // Carrega Telemetria
  const loadHealth = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/health', getDevHeaders());
      setHealthData(res.data);
    } catch (err: any) {
      console.error('Erro ao carregar telemetria:', err);
      if (err.response?.status === 401) handleLogoutDev();
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  // Carrega Lista de Tenants
  const loadTenants = useCallback(async () => {
    if (!devToken) return;
    try {
      setLoading(true);
      const res = await api.get('/dev/tenants', getDevHeaders());
      setTenants(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [devToken, getDevHeaders]);

  // Carrega Audit Logs
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

  useEffect(() => {
    if (!devToken) return;
    if (currentTab === 'health') loadHealth();
    if (currentTab === 'tenants') loadTenants();
    if (currentTab === 'audit') loadAuditLogs();
  }, [devToken, currentTab, loadHealth, loadTenants, loadAuditLogs]);

  // Criar Novo Tenant
  const handleCreateTenant = async () => {
    if (!newTenantName || !newTenantSlug || !newAdminEmail || !newAdminPassword || !newAdminName || !newAdminNomeGuerra) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigat�rios (*).' });
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
      // Limpa campos
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

  // Alterar Status do Tenant
  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/dev/tenants/${id}/status`, { status: nextStatus }, getDevHeaders());
      loadTenants();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao alterar status.' });
    }
  };

  // Testar E-mail Diagn�stico
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) {
      setFeedback({ type: 'error', message: 'Informe um e-mail de destino para o teste.' });
      return;
    }
    try {
      setSendingTestEmail(true);
      setFeedback(null);
      const res = await api.post('/dev/test-email', { targetEmail: testEmailAddress.trim() }, getDevHeaders());
      setFeedback({
        type: res.data.success ? 'success' : 'error',
        message: res.data.message,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao enviar e-mail de teste.' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Testar Push Diagn�stico
  const handleSendTestPush = async () => {
    try {
      setSendingTestPush(true);
      setFeedback(null);
      const res = await api.post('/dev/test-push', { title: testPushTitle, body: testPushBody }, getDevHeaders());
      setFeedback({
        type: res.data.success ? 'success' : 'error',
        message: res.data.message,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Erro ao disparar push de teste.' });
    } finally {
      setSendingTestPush(false);
    }
  };

  // ==========================================
  // TELA DE AUTENTICA��O COM CHAVE MESTRA
  // ==========================================
  if (!devToken) {
    return (
      <View style={styles.authContainer}>
        <ScreenCode code="DEV-AUTH" />
        <View style={styles.authCard}>
          <View style={styles.authHeaderBadge}>
            <Text style={styles.authBadgeText}>? SUPERADMIN CONSOLE</Text>
          </View>
          <Text style={styles.authTitle}>ABIATAR � Painel DEV</Text>
          <Text style={styles.authDesc}>
            �rea restrita de controle t�cnico, telemetria, banco de dados e gest�o Multi-Tenant SaaS.
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
            {authLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.authButtonText}>Entrar no Console DEV</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={onBack}>
            <Text style={{ color: '#71717a', fontSize: 13 }}>? Voltar para o Sistema</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================
  // DASHBOARD DEV COMPLETO
  // ==========================================
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
            <Text style={styles.headerBtnText}>?? Ver PWA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { borderColor: '#ef4444' }]} onPress={handleLogoutDev}>
            <Text style={[styles.headerBtnText, { color: '#ef4444' }]}>Encerrar Sess�o DEV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS NAVIGATION */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'health' && styles.tabItemActive]}
          onPress={() => setCurrentTab('health')}
        >
          <Text style={currentTab === 'health' ? styles.tabTextActive : styles.tabText}>?? Telemetria & Sa�de</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'tenants' && styles.tabItemActive]}
          onPress={() => setCurrentTab('tenants')}
        >
          <Text style={currentTab === 'tenants' ? styles.tabTextActive : styles.tabText}>?? Multi-Tenant SaaS ({tenants.length || 0})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'audit' && styles.tabItemActive]}
          onPress={() => setCurrentTab('audit')}
        >
          <Text style={currentTab === 'audit' ? styles.tabTextActive : styles.tabText}>?? Caixa-Preta (Audit Logs)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'tools' && styles.tabItemActive]}
          onPress={() => setCurrentTab('tools')}
        >
          <Text style={currentTab === 'tools' ? styles.tabTextActive : styles.tabText}>? Dev Tools & Diagn�stico</Text>
        </TouchableOpacity>
      </View>

      {/* FEEDBACK TOAST */}
      {feedback && (
        <View style={[styles.feedbackBanner, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          <TouchableOpacity onPress={() => setFeedback(null)}>
            <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 10 }}>?</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTE�DO PRINCIPAL */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading && !healthData && !tenants.length && !auditLogs.length ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={{ color: '#71717a', marginTop: 10 }}>Consultando telemetria...</Text>
          </View>
        ) : null}

        {/* ---------------------------------------------------- */}
        {/* ABA 1: TELEMETRIA & SA�DE */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'health' && healthData && (
          <View style={{ gap: 16 }}>
            {/* CARDS DE M�TRICAS R�PIDAS */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>BANCO DE DADOS</Text>
                <Text style={[styles.metricValue, { color: '#4ade80' }]}>
                  {healthData.database.status === 'healthy' ? '?? Saud�vel' : '?? Erro'}
                </Text>
                <Text style={styles.metricSub}>Lat�ncia: {healthData.database.latencyMs} ms</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TEMPO DE ATIVIDADE (UPTIME)</Text>
                <Text style={styles.metricValue}>{healthData.system.uptime}</Text>
                <Text style={styles.metricSub}>Node {healthData.system.nodeVersion} � {healthData.system.environment}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>CONSUMO DE MEM�RIA (RAM)</Text>
                <Text style={styles.metricValue}>{healthData.system.memory.heapUsed}</Text>
                <Text style={styles.metricSub}>Heap: {healthData.system.memory.heapTotal} | RSS: {healthData.system.memory.rss}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>CHECK-INS DE CORRETORES HOJE</Text>
                <Text style={[styles.metricValue, { color: '#38bdf8' }]}>{healthData.counts.presencesToday}</Text>
                <Text style={styles.metricSub}>Total de presen�as registradas</Text>
              </View>
            </View>

            {/* TOTAIS DO SISTEMA */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <Text style={styles.sectionTitle}>?? Contadores Globais do SaaS</Text>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadHealth}>
                  <Text style={styles.refreshBtnText}>?? Atualizar Telemetria</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.grid3}>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatNum}>{healthData.counts.tenants}</Text>
                  <Text style={styles.subStatTitle}>Imobili�rias / Construtoras</Text>
                </View>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatNum}>{healthData.counts.users}</Text>
                  <Text style={styles.subStatTitle}>Usu�rios Cadastrados</Text>
                </View>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatNum}>{healthData.counts.booths}</Text>
                  <Text style={styles.subStatTitle}>Plant�es de Vendas</Text>
                </View>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatNum}>{healthData.counts.auditLogs}</Text>
                  <Text style={styles.subStatTitle}>Registros de Auditoria</Text>
                </View>
                <View style={styles.subStatBox}>
                  <Text style={styles.subStatNum}>{healthData.counts.pushTokens}</Text>
                  <Text style={styles.subStatTitle}>Dispositivos Push Ativos</Text>
                </View>
              </View>
            </View>

            {/* INTEGRA��ES EXTERNAS */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>?? Status dos Servi�os Conectados</Text>
              <View style={styles.grid2}>
                <View style={styles.integrationCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>?? Resend E-mail Transacional</Text>
                    <Text style={{ color: healthData.integrations.resend.configured ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                      {healthData.integrations.resend.status}
                    </Text>
                  </View>
                  <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                    Remetente configurado: <Text style={{ color: '#38bdf8' }}>{healthData.integrations.resend.fromDomain}</Text>
                  </Text>
                </View>

                <View style={styles.integrationCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>?? Firebase Cloud Messaging (Push)</Text>
                    <Text style={{ color: healthData.integrations.firebase.configured ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                      {healthData.integrations.firebase.status}
                    </Text>
                  </View>
                  <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                    Tokens ativos registrados: <Text style={{ color: '#38bdf8' }}>{healthData.integrations.firebase.registeredTokens}</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* ABA 2: MULTI-TENANT SAAS */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'tenants' && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>?? Imobili�rias & Construtoras Ativas</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowNewTenantModal(true)}>
                <Text style={styles.createBtnText}>+ Criar Nova Imobili�ria</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {tenants.map((t) => (
                <View key={t.id} style={styles.tenantCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.primary_color }} />
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{t.name}</Text>
                        <Text style={{ fontSize: 12, color: '#38bdf8' }}>slug: {t.slug}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.badge, t.status_assinatura === 'active' ? styles.badgeActive : styles.badgeInactive]}>
                        <Text style={styles.badgeText}>{t.status_assinatura.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleToggleTenantStatus(t.id, t.status_assinatura)}
                      >
                        <Text style={styles.actionBtnText}>
                          {t.status_assinatura === 'active' ? 'Suspender' : 'Ativar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.tenantStatsRow}>
                    <Text style={styles.tenantStatItem}>?? Corretores: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalBrokers || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>?? Gerentes: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalManagers || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>?? Plant�es: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t.stats?.totalBooths || 0}</Text></Text>
                    <Text style={styles.tenantStatItem}>?? Check-ins Hoje: <Text style={{ color: '#4ade80', fontWeight: 'bold' }}>{t.stats?.presencesToday || 0}</Text></Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* ABA 3: CAIXA-PRETA (AUDIT LOGS) */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'audit' && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>?? Linha do Tempo de Auditoria ({auditTotal})</Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadAuditLogs}>
                <Text style={styles.refreshBtnText}>?? Atualizar Logs</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por a��o, e-mail do autor, entidade..."
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#38bdf8' }}>{log.action}</Text>
                    <Text style={{ fontSize: 11, color: '#71717a' }}>
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#a1a1aa' }}>
                    Autor: <Text style={{ color: '#fff' }}>{log.actor_email_snapshot || 'Sistema'}</Text> ({log.actor_role || '�'})
                  </Text>
                  {log.reason ? (
                    <Text style={{ fontSize: 12, color: '#eab308', marginTop: 2 }}>Motivo: {log.reason}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            {/* PAGINA��O */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.pageBtn, auditPage <= 1 && { opacity: 0.5 }]}
                disabled={auditPage <= 1}
                onPress={() => setAuditPage((p) => Math.max(1, p - 1))}
              >
                <Text style={styles.pageBtnText}>? Anterior</Text>
              </TouchableOpacity>
              <Text style={{ color: '#a1a1aa', alignSelf: 'center', fontSize: 13 }}>P�gina {auditPage}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, auditLogs.length < 20 && { opacity: 0.5 }]}
                disabled={auditLogs.length < 20}
                onPress={() => setAuditPage((p) => p + 1)}
              >
                <Text style={styles.pageBtnText}>Pr�xima ?</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* ABA 4: DEV TOOLS & DIAGN�STICO */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'tools' && (
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>? Ferramentas R�pidas de Diagn�stico</Text>

            {/* TESTE DE E-MAIL */}
            <View style={styles.sectionCard}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                ?? Disparo de E-mail de Diagn�stico (Resend)
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
                <TouchableOpacity
                  style={[styles.createBtn, sendingTestEmail && { opacity: 0.7 }]}
                  onPress={handleSendTestEmail}
                  disabled={sendingTestEmail}
                >
                  <Text style={styles.createBtnText}>
                    {sendingTestEmail ? 'Enviando...' : 'Enviar E-mail'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TESTE DE PUSH */}
            <View style={styles.sectionCard}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                ?? Disparo de Notifica��o Push (Firebase FCM)
              </Text>
              <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 12 }}>
                Dispara um push de telemetria para os dispositivos conectados.
              </Text>
              <TextInput
                style={[styles.searchInput, { marginBottom: 8 }]}
                placeholder="T�tulo da notifica��o..."
                placeholderTextColor="#71717a"
                value={testPushTitle}
                onChangeText={setTestPushTitle}
              />
              <TextInput
                style={[styles.searchInput, { marginBottom: 12 }]}
                placeholder="Corpo da mensagem..."
                placeholderTextColor="#71717a"
                value={testPushBody}
                onChangeText={setTestPushBody}
              />
              <TouchableOpacity
                style={[styles.createBtn, sendingTestPush && { opacity: 0.7 }]}
                onPress={handleSendTestPush}
                disabled={sendingTestPush}
              >
                <Text style={styles.createBtnText}>
                  {sendingTestPush ? 'Disparando...' : 'Disparar Push de Teste'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* MODAL: CRIAR NOVO TENANT */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showNewTenantModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
              ?? Criar Nova Imobili�ria / Construtora
            </Text>
            <Text style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 14 }}>
              Configura��o r�pida de tenant SaaS e cria��o do primeiro Diretor Master.
            </Text>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Nome da Empresa *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Cury Vendas"
                placeholderTextColor="#71717a"
                value={newTenantName}
                onChangeText={setNewTenantName}
              />

              <Text style={styles.inputLabel}>Subdom�nio / Slug *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: cury (letras min�sculas e h�fens)"
                placeholderTextColor="#71717a"
                value={newTenantSlug}
                onChangeText={(v) => setNewTenantSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Cor Prim�ria (Hex)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="#E31C1C"
                placeholderTextColor="#71717a"
                value={newTenantColor}
                onChangeText={setNewTenantColor}
              />

              <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: 12 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#38bdf8', marginBottom: 8 }}>
                ?? Administrador Inicial (Diretoria Level 1)
              </Text>

              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Carlos Diretor"
                placeholderTextColor="#71717a"
                value={newAdminName}
                onChangeText={setNewAdminName}
              />

              <Text style={styles.inputLabel}>Nome de Guerra *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: CARLOS"
                placeholderTextColor="#71717a"
                value={newAdminNomeGuerra}
                onChangeText={(v) => setNewAdminNomeGuerra(v.toUpperCase())}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>E-mail de Acesso *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: diretor@empresa.com.br"
                placeholderTextColor="#71717a"
                value={newAdminEmail}
                onChangeText={setNewAdminEmail}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Senha Inicial *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="M�nimo 6 caracteres..."
                placeholderTextColor="#71717a"
                value={newAdminPassword}
                onChangeText={setNewAdminPassword}
                secureTextEntry
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowNewTenantModal(false)}
                disabled={savingTenant}
              >
                <Text style={{ color: '#a1a1aa', fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, savingTenant && { opacity: 0.7 }]}
                onPress={handleCreateTenant}
                disabled={savingTenant}
              >
                <Text style={styles.createBtnText}>
                  {savingTenant ? 'Criando...' : 'Salvar e Ativar Empresa'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
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
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181c',
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#121215',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingHorizontal: 16,
    gap: 8,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#38bdf8',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717a',
  },
  tabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
  },
  scrollContent: {
    padding: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
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
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  metricSub: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  sectionCard: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  subStatNum: {
    fontSize: 24,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 2,
  },
  subStatTitle: {
    fontSize: 11,
    color: '#a1a1aa',
    textAlign: 'center',
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
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
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  createBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
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
  },
  badgeActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  badgeInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#27272a',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  tenantStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e1e24',
  },
  tenantStatItem: {
    fontSize: 12,
    color: '#a1a1aa',
  },
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
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  feedbackBanner: {
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackSuccess: {
    backgroundColor: '#15803d',
  },
  feedbackError: {
    backgroundColor: '#b91c1c',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
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
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    marginBottom: 4,
    marginTop: 8,
  },
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
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  authBadgeText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 6,
  },
  authDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    lineHeight: 18,
    marginBottom: 20,
  },
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
  authButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
});
