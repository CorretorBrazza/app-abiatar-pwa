// src/screens/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  ScrollView,
  TouchableOpacity, 
  ActivityIndicator, 
  Platform,
  Linking,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import CheckIn from './CheckIn';
import Inbox from './Inbox'; 
import ManagerPanel from './ManagerPanel'; 
import StatisticsPanel from './StatisticsPanel'; // <-- ADICIONE ESTA IMPORTAÇÃO DO PAINEL DE BI
import ReceptionPanel from './ReceptionPanel';
import PushToast from '../components/PushToast';
import PushSetupButton from '../components/PushSetupButton';
import OperationalAlert from '../components/OperationalAlert';
import ScreenCode from '../components/ScreenCode';
import api from '../services/api';

export default function Dashboard() {
  const { user, tenant, logout } = useAuth();
  
  // Controle de estado da presença física para corretores (Nível 3)
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [endingShift, setEndingShift] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushNotice, setPushNotice] = useState<{ title: string; body: string } | null>(null);
  const [operationalNotice, setOperationalNotice] = useState<{ title: string; body: string } | null>(null);

  // CONTROLE DE NAVEGAÇÃO INTERNA DINÂMICA (MAIN, INBOX, GESTÃO E BI)
  const [currentView, setCurrentView] = useState<'main' | 'inbox' | 'manager_panel' | 'statistics'>('main'); // <-- ADICIONADO "statistics" AQUI

  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const isManager = user?.role === 'gerencia_level_2';
  const isDirector = user?.role === 'diretoria_level_1';

  // 1. Efeito Inicial: Busca se o corretor já possui um turno ativo online na nuvem
  useEffect(() => {
    async function checkCurrentSession() {
      if (user?.role !== 'corretor_level_3') {
        setLoadingSession(false);
        return;
      }

      try {
        const response = await api.get('/presences/current');
        if (response.data.hasActiveSession) {
          setActiveSession(response.data.presence);
          
          // Se houver um ping pendente na nuvem, abre o modal de confirmação na tela na hora!
          setPendingSessionPingId(response.data.presence.pendingPingId);
        } else {
          setActiveSession(null);
          setPendingSessionPingId(null);
        }
      } catch (error) {
        console.error(
          '[SESSION - ERRO] Falha ao recuperar sessão de check-in:',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setLoadingSession(false);
      }
    }

    checkCurrentSession();

    // Ativa o Polling (Verificação silenciosa a cada 15 segundos) se for corretor logado
    let intervalId: any;
    if (user?.role === 'corretor_level_3') {
      intervalId = setInterval(checkCurrentSession, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const loadUnreadCount = async () => {
      try {
        const response = await api.get('/messages/my-inbox');
        if (mounted) {
          setUnreadCount(Array.isArray(response.data) ? response.data.filter((item: any) => !item.read_at).length : 0);
        }
      } catch (error) {
        console.warn('[INBOX] Falha ao atualizar contador de não lidas:', error);
      }
    };

    loadUnreadCount();
    const intervalId = setInterval(loadUnreadCount, 15000);
    let noticeTimeout: ReturnType<typeof setTimeout> | undefined;
    const handlePush = (event: Event) => {
      void loadUnreadCount();
      const payload = (event as CustomEvent).detail || {};
      const notice = {
        title: payload.notification?.title || (payload.data?.type === 'operational_push' ? 'Alerta operacional' : 'Nova mensagem ABIATAR'),
        body: payload.notification?.body || 'Você recebeu uma nova mensagem.',
      };
      if (payload.data?.type === 'operational_push') {
        setOperationalNotice(notice);
      } else {
        setPushNotice(notice);
        if (noticeTimeout) clearTimeout(noticeTimeout);
        noticeTimeout = setTimeout(() => setPushNotice(null), 10000);
      }
    };
    window.addEventListener('abiatar:push', handlePush);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (noticeTimeout) clearTimeout(noticeTimeout);
      window.removeEventListener('abiatar:push', handlePush);
    };
  }, [user]);

  // Auxiliar para setar o ID do ping no polling
  const setPendingSessionPingId = (id: string | null) => {
    // Implementado no componente filho ou estado do modal interno
  };

  const materialsUrl = 'https://linktr.ee/Abiatarimoveisconstrutora?utm_source=linktree_admin_share';

  const handleOpenMaterials = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(materialsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    await Linking.openURL(materialsUrl);
  };

  // 2. Método de Check-out
  const handleCheckOut = async () => {
    try {
      setEndingShift(true);
      const response = await api.post('/presences/check-out');
      alert(`Turno finalizado com sucesso! Tempo total de permanência: ${response.data.totalMinutes} minutos.`);
      setActiveSession(null);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Falha ao realizar check-out.';
      alert(msg);
    } finally {
      setEndingShift(false);
    }
  };

  if (loadingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Verificando status de presença...</Text>
      </View>
    );
  }

  if (user?.role === 'recepcao_level_3') {
    return <ReceptionPanel />;
  }

  // ==========================================
  // ROTA DO PAINEL DE BI / ESTATÍSTICAS (DIRETORIA)
  // ==========================================
  if (currentView === 'statistics') {
    return <StatisticsPanel onBack={() => setCurrentView('main')} />;
  }

  // ==========================================
  // ROTA DA GESTÃO DE CORRETORES (GERENTE / DIRETORIA)
  // ==========================================
  if (currentView === 'manager_panel') {
    return <ManagerPanel onBack={() => setCurrentView('main')} />;
  }

  // ==========================================
  // ROTA DO INBOX (SE ATIVA, RENDERIZA O INBOX SOBREPOSTO)
  // ==========================================
  if (currentView === 'inbox') {
    return <Inbox onBack={() => setCurrentView('main')} />;
  }

  // ==========================================
  // FLUXO DO CORRETOR (NÍVEL 3)
  // ==========================================
  if (user?.role === 'corretor_level_3') {
    if (!activeSession) {
      return (
        <View style={styles.container}>
          {pushNotice && <PushToast title={pushNotice.title} body={pushNotice.body} onPress={() => { setPushNotice(null); setCurrentView('inbox'); }} />}
      {operationalNotice && <OperationalAlert title={operationalNotice.title} body={operationalNotice.body} onAcknowledge={() => setOperationalNotice(null)} />}
          <View style={{ flex: 1 }}>
            <ScreenCode code="CR-01" />
            <CheckIn 
              onCheckInSuccess={(data) => {
                setActiveSession({
                  boothName: 'Plantão Ativo',
                  checkInAt: new Date(),
                });
              }} 
            />
          </View>
          
          <View style={styles.footerLogout}>
            <PushSetupButton />
            <TouchableOpacity 
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 12 }]} 
              onPress={() => setCurrentView('inbox')}
            >
              <View style={styles.buttonRow}>
                <Text style={[styles.msgText, { color: primaryColor }]}>Ver Mensagens / Inbox</Text>
                {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.logoutButton, { borderColor: primaryColor }]} 
              onPress={logout}
            >
              <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão (Sair)</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {pushNotice && <PushToast title={pushNotice.title} body={pushNotice.body} onPress={() => { setPushNotice(null); setCurrentView('inbox'); }} />}
      {operationalNotice && <OperationalAlert title={operationalNotice.title} body={operationalNotice.body} onAcknowledge={() => setOperationalNotice(null)} />}
        <ScreenCode code="CR-02" />
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <Text style={styles.tenantName}>{tenant?.name}</Text>
          <Text style={styles.roleTag}>Corretor Ativo</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.welcomeTitle}>Olá, {user?.nome_guerra}!</Text>
          <Text style={styles.welcomeSubtitle}>Você está ativo e em plantão de vendas.</Text>

          <View style={styles.card}>
            <Text style={styles.infoTitle}>Informações do Turno Atual</Text>
            <Text style={styles.infoText}>Status: 🟢 ONLINE (Apto a receber leads)</Text>
            <Text style={styles.infoText}>Plantão: {activeSession.boothName}</Text>
            <Text style={styles.infoText}>
              Entrada: {new Date(activeSession.checkInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.checkoutButton, { backgroundColor: primaryColor, marginBottom: 16 }]} 
            onPress={handleCheckOut}
            disabled={endingShift}
          >
            {endingShift ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Finalizar Turno (Check-out)</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16 }]} 
            onPress={() => setCurrentView('inbox')}
          >
            <View style={styles.buttonRow}>
              <Text style={[styles.msgText, { color: primaryColor }]}>Ver Mensagens / Alertas</Text>
              {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
            </View>
          </TouchableOpacity>

          <View style={styles.productivitySection}>
            <Text style={styles.productivityTitle}>Materiais para atendimento</Text>
            <TouchableOpacity
              style={[styles.resourceButton, styles.resourceButtonDisabled]}
              onPress={() => alert('A Tabela de Preços Atualizada estará disponível em breve.')}
            >
              <Text style={styles.resourceButtonText}>Tabela de Preços Atualizada</Text>
              <Text style={styles.resourceHint}>Material em preparação</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resourceButton, { backgroundColor: primaryColor }]}
              onPress={handleOpenMaterials}
            >
              <Text style={styles.resourceButtonText}>Material Empreendimentos</Text>
              <Text style={styles.resourceHintLight}>Abrir material Abiatar</Text>
            </TouchableOpacity>
          </View>

          <PushSetupButton />
          <TouchableOpacity 
            style={[styles.logoutButton, { borderColor: primaryColor }]} 
            onPress={logout}
          >
            <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão (Sair)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================
  // FLUXO PRINCIPAL POR NÍVEL HIERÁRQUICO
  // ==========================================
  return (
    <View style={styles.container}>
      {pushNotice && <PushToast title={pushNotice.title} body={pushNotice.body} onPress={() => { setPushNotice(null); setCurrentView('inbox'); }} />}
      {operationalNotice && <OperationalAlert title={operationalNotice.title} body={operationalNotice.body} onAcknowledge={() => setOperationalNotice(null)} />}
      <ScreenCode code={isManager ? 'GE-01' : isDirector ? 'DR-01' : 'AD-01'} />
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <Text style={styles.tenantName}>{tenant?.name}</Text>
        <Text style={styles.roleTag}>{isManager ? 'Gerência' : isDirector ? 'Diretoria' : 'Administrador'}</Text>
      </View>

      <ScrollView
        style={styles.dashboardScroll}
        contentContainerStyle={styles.dashboardScrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.welcomeTitle}>Olá, {user?.nome_guerra}!</Text>
        <Text style={styles.welcomeSubtitle}>
          {isManager ? 'Acompanhe sua equipe, os corretores e as comunicações do plantão.' : 'Seja bem-vindo à sua área de trabalho administrativa.'}
        </Text>

        {isManager ? (
          <>
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Resumo da Gerência</Text>
              <Text style={styles.infoText}>Empresa: {tenant?.name}</Text>
              <Text style={styles.infoText}>Acesso: gestão da equipe de corretores</Text>
              <Text style={styles.infoText}>Use o painel de gestão para convites, aprovações e fila de leads.</Text>
            </View>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('manager_panel')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Abrir Gestão da Minha Equipe</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Status da Construtora (Tenant)</Text>
              <Text style={styles.infoText}>Sua empresa: {tenant?.name}</Text>
              <Text style={styles.infoText}>Identificador (Slug): {tenant?.slug}</Text>
              <Text style={styles.infoText}>ID da Nuvem: {tenant?.id}</Text>
            </View>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('statistics')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Ver Inteligência de Plantão (BI)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('manager_panel')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Gerenciar Corretores / Equipe</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
          onPress={() => setCurrentView('inbox')}
        >
          <View style={styles.buttonRow}>
            <Text style={[styles.msgText, { color: primaryColor }]}>{isManager ? 'Ver Mensagens da Equipe' : 'Ver Mensagens / Alertas Recebidos'}</Text>
            {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
          </View>
        </TouchableOpacity>

        <PushSetupButton />
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: primaryColor, width: '100%', maxWidth: 520 }]}
          onPress={logout}
        >
          <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
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
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tenantName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  roleTag: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  dashboardScroll: {
    flex: 1,
  },
  dashboardScrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#3a3a3c',
    marginBottom: 8,
  },
  logoutButton: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  productivitySection: { width: '100%', maxWidth: 520, marginBottom: 16 },
  productivityTitle: { color: '#1c1c1e', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  resourceButton: { minHeight: 58, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center', marginBottom: 10 },
  resourceButtonDisabled: { backgroundColor: '#e5e5ea' },
  resourceButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  resourceHint: { color: '#636366', fontSize: 11, marginTop: 3 },
  resourceHintLight: { color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 3 },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutButton: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerLogout: {
    width: '100%',
    backgroundColor: '#f5f5f7',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e5ea',
  },
  msgButton: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  msgText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
