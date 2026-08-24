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
import * as Location from 'expo-location';
import CheckIn from './CheckIn';
import Inbox from './Inbox'; 
import ManagerPanel from './ManagerPanel'; 
import StatisticsPanel from './StatisticsPanel'; // <-- ADICIONE ESTA IMPORTAÇÃO DO PAINEL DE BI
import BoothRulesPanel from './BoothRulesPanel';
import ReceptionPanel from './ReceptionPanel';
import PushToast from '../components/PushToast';
import PushSetupButton from '../components/PushSetupButton';
import OperationalAlert from '../components/OperationalAlert';
import ScreenCode from '../components/ScreenCode';
import BrokerMaterials from '../components/BrokerMaterials';
import DirectorMessagingPanel from './DirectorMessagingPanel';
import UserManagementPanel from './UserManagementPanel';
import api, { apiBaseUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Dashboard() {
  const { user, tenant, logout } = useAuth();
  
  // Controle de estado da presença física para corretores (Nível 3)
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [endingShift, setEndingShift] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushNotice, setPushNotice] = useState<{ title: string; body: string } | null>(null);
  const [operationalNotice, setOperationalNotice] = useState<{ title: string; body: string } | null>(null);
  const [brokerSummary, setBrokerSummary] = useState<any | null>(null);
  const [pendingSessionPingId, setPendingSessionPingIdState] = useState<string | null>(null);
  const [confirmingPresence, setConfirmingPresence] = useState(false);

  // CONTROLE DE NAVEGAÇÃO INTERNA DINÂMICA (MAIN, INBOX, GESTÃO E BI)
  const [currentView, setCurrentView] = useState<'main' | 'inbox' | 'manager_panel' | 'statistics' | 'booth_rules' | 'director_messaging' | 'user_management'>('main');

  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const isManager = user?.role === 'gerencia_level_2';
  const isDirector = user?.role === 'diretoria_level_1';
  const canManageUsers = tenant?.settings?.features?.manager_management !== false || tenant?.settings?.features?.reception_management !== false;

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/messages/my-inbox');
      setUnreadCount(Array.isArray(response.data) ? response.data.filter((item: any) => !item.read_at).length : 0);
    } catch (error) {
      console.warn('[INBOX] Falha ao atualizar contador de não lidas:', error);
    }
  };

  // 1. Efeito Inicial: Busca se o corretor já possui um turno ativo online na nuvem
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function checkCurrentSession() {
      if (user?.role !== 'corretor_level_3') {
        setLoadingSession(false);
        return;
      }

      try {
        const response = await api.get('/presences/current');
        if (response.data.hasActiveSession) {
          setActiveSession(response.data.presence);
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

    async function loadBrokerSummary() {
      if (user?.role !== 'corretor_level_3') return;
      try {
        const response = await api.get('/presences/dashboard-summary');
        setBrokerSummary(response.data);
      } catch (error) {
        console.warn('[BROKER SUMMARY] Falha ao atualizar períodos do corretor:', error);
      }
    }

    async function connectRealtime() {
      const token = await AsyncStorage.getItem('@abiatar:token');
      if (!token || cancelled || typeof fetch === 'undefined') return;
      try {
        const response = await fetch(`${apiBaseUrl}/realtime/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const rawData = dataLine.replace(/^data:\s*/, '').trim();
              if (!rawData) continue;
              const event = JSON.parse(rawData);
              console.log('[REALTIME SSE EVENT RECEIVED]', event.eventType, event);

              // Atualiza instantaneamente a tela do corretor e plantões
              if (
                event.eventType?.startsWith('booth.') ||
                event.eventType?.startsWith('presence.') ||
                event.eventType?.startsWith('roleta.') ||
                event.eventType?.startsWith('broker.')
              ) {
                void checkCurrentSession();
                void loadBrokerSummary();
              }

              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('abiatar:realtime', { detail: event }));
                if (event.eventType?.startsWith('booth.')) {
                  window.dispatchEvent(new CustomEvent('abiatar:booth_update', { detail: event }));
                }
              }

              if (event.eventType?.startsWith('message.')) {
                void loadUnreadCount();
              }
            } catch { /* heartbeat ou evento de formato diferente */ }
          }
        }
      } catch (error) {
        if (!cancelled) retryTimer = setTimeout(connectRealtime, 4000);
      }
    }

    checkCurrentSession();
    loadBrokerSummary();
    void connectRealtime();

    // Ativa o Polling (Verificação silenciosa a cada 10 segundos) se for corretor logado
    let intervalId: any;
    if (user?.role === 'corretor_level_3') {
      intervalId = setInterval(() => {
        checkCurrentSession();
        loadBrokerSummary();
      }, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (retryTimer) clearTimeout(retryTimer);
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    void loadUnreadCount();
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
      clearInterval(intervalId);
      if (noticeTimeout) clearTimeout(noticeTimeout);
      window.removeEventListener('abiatar:push', handlePush);
    };
  }, [user]);

  // Auxiliar para setar o ID do ping no polling
  const setPendingSessionPingId = (id: string | null) => setPendingSessionPingIdState(id);

  const materialsUrl = 'https://linktr.ee/Abiatarimoveisconstrutora?utm_source=linktree_admin_share';

  const handleOpenMaterials = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(materialsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    await Linking.openURL(materialsUrl);
  };

  const handlePresenceConfirmation = async (confirm: boolean) => {
    if (!pendingSessionPingId) return;
    if (!confirm) { await handleCheckOut(); setPendingSessionPingIdState(null); return; }
    try {
      setConfirmingPresence(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('A confirmação exige permissão de localização.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api.post('/presences/ping-response', { pingLogId: pendingSessionPingId, latitude: location.coords.latitude, longitude: location.coords.longitude });
      setPendingSessionPingIdState(null);
      alert('Presença confirmada. O próximo ciclo será calculado automaticamente.');
      const current = await api.get('/presences/current');
      setActiveSession(current.data.presence);
    } catch (error: any) { alert(error.response?.data?.message || error.message || 'Não foi possível confirmar a presença.'); }
    finally { setConfirmingPresence(false); }
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

  if (user?.role === 'corretor_level_3' && pendingSessionPingId) {
    return <View style={styles.frozenContainer}><ScreenCode code="PR-02" /><Text style={styles.frozenTitle}>Você ainda está no plantão?</Text><Text style={styles.frozenText}>A confirmação é obrigatória para manter sua presença e continuar elegível aos leads.</Text><Text style={styles.frozenText}>Ao confirmar, sua localização será validada por GPS ou Wi-Fi, sem rastreamento contínuo.</Text><TouchableOpacity style={[styles.frozenButton, { backgroundColor: primaryColor }]} onPress={() => void handlePresenceConfirmation(true)} disabled={confirmingPresence}><Text style={styles.frozenButtonText}>{confirmingPresence ? 'Validando presença...' : 'Sim, ainda estou no plantão'}</Text></TouchableOpacity><TouchableOpacity style={styles.frozenNoButton} onPress={() => void handlePresenceConfirmation(false)} disabled={confirmingPresence}><Text style={styles.frozenNoText}>Não, fazer checkout</Text></TouchableOpacity></View>;
  }

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

  if (currentView === 'booth_rules') {
    return <BoothRulesPanel onBack={() => setCurrentView('main')} />;
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

  if (currentView === 'director_messaging') {
    return <DirectorMessagingPanel primaryColor={primaryColor} isManager={isManager} onBack={() => setCurrentView('main')} />;
  }

  if (currentView === 'user_management') {
    return <UserManagementPanel primaryColor={primaryColor} onBack={() => setCurrentView('main')} />;
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
          <ScreenCode code="CR-01" />
          <View style={[styles.header, { backgroundColor: primaryColor }]}>
            <View style={styles.headerRow}>
              <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>Corretor</Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={styles.dashboardScroll}
            contentContainerStyle={styles.brokerScrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.welcomeTitle}>Olá, {user?.nome_guerra}!</Text>
            <Text style={styles.welcomeSubtitle}>Selecione o seu plantão de vendas atual para iniciar o turno.</Text>

            <CheckIn 
              onCheckInSuccess={(data) => {
                setActiveSession({
                  boothName: data?.booth?.name || 'Plantão Ativo',
                  checkInAt: new Date(),
                });
              }} 
            />

            <View style={styles.brokerPeriodsCard}>
              <Text style={styles.brokerPeriodsTitle}>Minhas Roletas da Semana e Elegibilidade</Text>
              <Text style={[styles.infoText, { color: '#6b7280', fontSize: 12, marginBottom: 8 }]}>
                Contagem semanal (Segunda a Domingo) · Elegibilidade calculada por plantão
              </Text>
              
              <Text style={styles.infoText}>Total de Roletas cumpridas na semana: <Text style={{ fontWeight: '800' }}>{brokerSummary?.validPeriods ?? 0}</Text></Text>
              {brokerSummary?.invalidatedPeriods > 0 && <Text style={styles.invalidPeriodText}>Roletas incompletas/invalidadas: {brokerSummary.invalidatedPeriods}</Text>}

              {Array.isArray(brokerSummary?.boothsEligibility) && brokerSummary.boothsEligibility.length > 0 && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Text style={[styles.infoText, { fontWeight: '700', color: '#1c1c1e', marginBottom: 2 }]}>Status por Plantão de Vendas:</Text>
                  {brokerSummary.boothsEligibility.map((booth: any) => (
                    <View key={booth.boothId} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                      <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>{booth.boothName}</Text>
                      <Text style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                        Roletas cumpridas no plantão: <Text style={{ fontWeight: '700' }}>{booth.validRoletasThisWeek}</Text>
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        <View style={{ backgroundColor: booth.saturdayEligible ? '#dcfce7' : '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: booth.saturdayEligible ? '#15803d' : '#b45309', fontSize: 11, fontWeight: '700' }}>
                            {booth.saturdayEligible ? '🟢 Sábado: Elegível' : `🟡 Sábado: Faltam ${booth.missingSaturday} (${booth.validRoletasThisWeek}/${booth.saturdayRequired})`}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: booth.sundayEligible ? '#dcfce7' : '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: booth.sundayEligible ? '#15803d' : '#b45309', fontSize: 11, fontWeight: '700' }}>
                            {booth.sundayEligible ? '🟢 Domingo: Elegível' : `🟡 Domingo: Faltam ${booth.missingSunday} (${booth.validRoletasThisWeek}/${booth.sundayRequired})`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]} 
              onPress={() => setCurrentView('inbox')}
            >
              <View style={styles.buttonRow}>
                <Text style={[styles.msgText, { color: primaryColor }]}>Ver Mensagens / Inbox</Text>
                {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
              </View>
            </TouchableOpacity>

            <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />

            <PushSetupButton />

            <TouchableOpacity 
              style={[styles.logoutButton, { borderColor: primaryColor, width: '100%', maxWidth: 520 }]} 
              onPress={logout}
            >
              <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão (Sair)</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {pushNotice && <PushToast title={pushNotice.title} body={pushNotice.body} onPress={() => { setPushNotice(null); setCurrentView('inbox'); }} />}
      {operationalNotice && <OperationalAlert title={operationalNotice.title} body={operationalNotice.body} onAcknowledge={() => setOperationalNotice(null)} />}
        <ScreenCode code="CR-02" />
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <View style={styles.headerRow}>
            <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>Corretor Ativo</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.dashboardScroll}
          contentContainerStyle={styles.brokerScrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.welcomeTitle}>Olá, {user?.nome_guerra}!</Text>
          <Text style={styles.welcomeSubtitle}>Você está ativo e em plantão de vendas.</Text>

          {/* DESTAQUE DA POSIÇÃO NA ROLETA / PÓS-BARRA */}
          <View style={[styles.card, { backgroundColor: '#1c1c1e', borderColor: '#333', borderWidth: 1 }]}>
            {brokerSummary?.activeShift?.roletaPosition ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#facc15', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {brokerSummary.activeShift.roletaName || 'Roleta Oficial'}
                  </Text>
                  <View style={{ backgroundColor: brokerSummary.activeShift.roletaEntryType === 'pos_barra' ? '#f59e0b' : '#15803d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {brokerSummary.activeShift.roletaEntryType === 'pos_barra' ? 'PÓS-BARRA' : 'SORTEADO NA ROLETA'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginVertical: 4 }}>
                  🎰 {brokerSummary.activeShift.roletaPosition}º Lugar na Fila
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginVertical: 8, gap: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    🕒 <Text style={{ fontWeight: '700', color: '#fff' }}>Check-in realizado às:</Text> {brokerSummary.activeShift.checkInAtFormatted || '—'}
                  </Text>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    🎯 <Text style={{ fontWeight: '700', color: '#fff' }}>Horário do sorteio:</Text> {brokerSummary.activeShift.drawTimeFormatted || '09:01'}
                  </Text>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    📌 <Text style={{ fontWeight: '700', color: '#fff' }}>Status:</Text> {brokerSummary.activeShift.roletaEntryType === 'pos_barra' ? 'Atendimento extra / Final da fila' : 'Aguarde ser anunciado na recepção'}
                  </Text>
                </View>
                <Text style={{ color: '#9ca3af', fontSize: 12, lineHeight: 17 }}>
                  {brokerSummary.activeShift.roletaEntryType === 'pos_barra'
                    ? 'Você entrou na tolerância Pós-Barra e foi alocado ao final da fila de atendimento e leads.'
                    : 'Ordem oficial sorteada para atendimento presencial na recepção e distribuição de novos leads.'}
                </Text>
              </>
            ) : brokerSummary?.activeShift?.waitingDraw ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3b82f6', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '800' }}>⏳ AGUARDANDO SORTEIO DA ROLETA</Text>
                  </View>
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', marginVertical: 4 }}>
                  Check-in Pontual Confirmado!
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginVertical: 8, gap: 4 }}>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    🕒 <Text style={{ fontWeight: '700', color: '#fff' }}>Check-in registrado às:</Text> {brokerSummary.activeShift.checkInAtFormatted || '—'}
                  </Text>
                  <Text style={{ color: '#facc15', fontSize: 12, fontWeight: '700' }}>
                    🎰 Horário do Sorteio: Às {brokerSummary.activeShift.drawTimeFormatted || '09:01'}
                  </Text>
                  <Text style={{ color: '#d1d5db', fontSize: 12 }}>
                    👥 <Text style={{ fontWeight: '700', color: '#fff' }}>Aguardando no estande:</Text> {brokerSummary.activeShift.waitingBrokersCount || 1} corretor(es)
                  </Text>
                </View>
                <Text style={{ color: '#9ca3af', fontSize: 12, lineHeight: 18 }}>
                  O sorteio automático das posições da roleta ocorrerá exatamente às <Text style={{ color: '#fff', fontWeight: '800' }}>{brokerSummary.activeShift.drawTimeFormatted || '09:01'}</Text>. Assim que a roleta girar, esta tela atualizará com sua posição!
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Turno Ativo no Plantão</Text>
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>Você está online e apto a receber clientes e leads.</Text>
              </>
            )}
          </View>

          {/* FILA DE ATENDIMENTO DO PLANTÃO AO VIVO */}
          {Array.isArray(brokerSummary?.activeShift?.boothQueue) && brokerSummary.activeShift.boothQueue.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Fila da Roleta no Plantão ({brokerSummary.activeShift.boothQueue.length})</Text>
              <Text style={[styles.infoText, { color: '#6b7280', fontSize: 12, marginBottom: 8 }]}>
                Ordem da roleta para recepção presencial e fila de leads CVCRM
              </Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                {brokerSummary.activeShift.boothQueue.map((item: any) => (
                  <View 
                    key={item.brokerId} 
                    style={[
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, borderWidth: 1 },
                      item.isCurrentBroker 
                        ? { backgroundColor: '#eff6ff', borderColor: '#3b82f6' } 
                        : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: '#1c1c1e', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{item.roletaPosition || '—'}º</Text>
                      </View>
                      <View>
                        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>
                          {item.nomeGuerra} {item.isCurrentBroker && <Text style={{ color: '#2563eb', fontWeight: '800' }}>(Você)</Text>}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>
                          {item.roletaEntryType === 'pos_barra' ? 'Pós-Barra' : 'Sorteio Pontual'} · {item.minutesActive} min cumpridos
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>🟢 Online</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.infoTitle}>Informações do Plantão</Text>
            <Text style={styles.infoText}>Status: 🟢 ONLINE (Apto a receber leads)</Text>
            <Text style={styles.infoText}>Plantão: {activeSession.boothName}</Text>
            <Text style={styles.infoText}>
              Entrada: {brokerSummary?.activeShift?.checkInAtFormatted || (activeSession?.checkInAt ? new Date(activeSession.checkInAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—')}
            </Text>
          </View>

          <View style={styles.brokerPeriodsCard}>
            <Text style={styles.brokerPeriodsTitle}>Validação da Roleta em Tempo Real</Text>
            <Text style={styles.infoText}>Roletas acumuladas na semana: {brokerSummary?.accumulatedPeriods ?? '—'}</Text>
            <Text style={styles.infoText}>
              Tempo cumprido na Roleta: {brokerSummary?.activeShift ? `${brokerSummary.activeShift.activeMinutes} min / ${brokerSummary.activeShift.minimumMinutes} min` : '—'}
            </Text>
            
            {Array.isArray(brokerSummary?.boothsEligibility) && brokerSummary.boothsEligibility.length > 0 && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={[styles.infoText, { fontWeight: '700', color: '#1c1c1e', marginBottom: 2 }]}>Elegibilidade Fim de Semana por Plantão:</Text>
                {brokerSummary.boothsEligibility.map((booth: any) => (
                  <View key={booth.boothId} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{booth.boothName} ({booth.validRoletasThisWeek} roletas)</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <View style={{ backgroundColor: booth.saturdayEligible ? '#dcfce7' : '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: booth.saturdayEligible ? '#15803d' : '#b45309', fontSize: 11, fontWeight: '700' }}>
                          {booth.saturdayEligible ? '🟢 Sábado: Elegível' : `🟡 Sáb: Faltam ${booth.missingSaturday}`}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: booth.sundayEligible ? '#dcfce7' : '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: booth.sundayEligible ? '#15803d' : '#b45309', fontSize: 11, fontWeight: '700' }}>
                          {booth.sundayEligible ? '🟢 Domingo: Elegível' : `🟡 Dom: Faltam ${booth.missingSunday}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {brokerSummary?.activeShift?.nextConfirmationAt ? (
              <Text style={[styles.infoText, { marginTop: 8 }]}>
                Próxima confirmação de presença: {new Date(brokerSummary.activeShift.nextConfirmationAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} (+5 min de tolerância)
              </Text>
            ) : null}
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

          <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />

          <PushSetupButton />
          <TouchableOpacity 
            style={[styles.logoutButton, { borderColor: primaryColor }]}
            onPress={logout}
          >
            <Text style={[styles.logoutText, { color: primaryColor }]}>Encerrar Sessão (Sair)</Text>
          </TouchableOpacity>
        </ScrollView>
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
        <View style={styles.headerRow}>
          <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{isManager ? 'Gerência' : isDirector ? 'Diretoria' : 'Administrador'}</Text>
          </View>
        </View>
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
              <Text style={styles.infoTitle}>Painel da Gerência</Text>
              <Text style={styles.infoText}>Acompanhe a assiduidade da sua equipe, envie convites, aprove novos corretores e gerencie a distribuição da fila de leads.</Text>
            </View>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('manager_panel')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Abrir Gestão da Minha Equipe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('director_messaging')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Enviar Mensagem à Minha Equipe</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('booth_rules')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Administrar Plantões e Regras</Text>
            </TouchableOpacity>

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

            <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('director_messaging')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Enviar Comunicação Institucional</Text>
            </TouchableOpacity>

            {canManageUsers && <TouchableOpacity
              style={[styles.msgButton, { borderColor: primaryColor, marginBottom: 16, width: '100%', maxWidth: 520 }]}
              onPress={() => setCurrentView('user_management')}
            >
              <Text style={[styles.msgText, { color: primaryColor }]}>Gerenciar Gerentes e Recepção</Text>
            </TouchableOpacity>}
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

const styles = StyleSheet.create({ frozenContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff7ed' }, frozenTitle: { fontSize: 26, fontWeight: '800', color: '#9a3412', textAlign: 'center', marginVertical: 14 }, frozenText: { maxWidth: 520, color: '#7c2d12', textAlign: 'center', lineHeight: 22, marginBottom: 10 }, frozenButton: { width: '100%', maxWidth: 520, minHeight: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 18 }, frozenButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 }, frozenNoButton: { width: '100%', maxWidth: 520, minHeight: 50, borderWidth: 1, borderColor: '#9a3412', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, frozenNoText: { color: '#9a3412', fontWeight: '800' },
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
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  tenantName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  roleTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  brokerScrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 64,
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
    maxWidth: 520,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  invalidPeriodText: { color: '#b42318', fontSize: 14, marginBottom: 6, fontWeight: '700' },
  infoText: {
    fontSize: 14,
    color: '#3a3a3c',
    marginBottom: 8,
  },
  logoutButton: {
    width: '100%',
    maxWidth: 520,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  brokerPeriodsCard: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e5ea' },
  brokerPeriodsTitle: { color: '#1c1c1e', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutButton: {
    width: '100%',
    maxWidth: 520,
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
    maxWidth: 520,
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
