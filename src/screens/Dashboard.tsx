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
import BrokerMaterials from '../components/BrokerMaterials';
import DirectorMessagingPanel from './DirectorMessagingPanel';
import UserManagementPanel from './UserManagementPanel';
import IconButton, { APP_ICONS } from '../components/IconButton';
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
  const [currentView, setCurrentView] = useState<'main' | 'inbox' | 'manager_panel' | 'statistics' | 'booth_rules' | 'director_messaging' | 'user_management' | 'check_in' | 'meus_plantoes'>('main');

  const primaryColor = tenant?.primary_color || '#e53924';
  const isManager = user?.role === 'gerencia_level_2';
  const isDirector = user?.role === 'diretoria_level_1' || user?.role === 'platform_admin_level_0';
  const isRh = user?.role === 'rh_level_2' || user?.role === 'rh_level_1';
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
      
      let location;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        location = await Location.getLastKnownPositionAsync();
        const ageMs = Date.now() - (location?.timestamp ?? 0);
        // Para a confirmação de presença (antifraude), tolerância máxima estrita de 60 segundos
        if (!location || ageMs > 60_000) {
          throw new Error('Não foi possível obter sinal de GPS recente no plantão para confirmar presença. Aproxime-se de uma área aberta ou conecte-se ao Wi-Fi oficial.');
        }
      }

      const capturedAt = Date.now();

      const response = await api.post('/presences/ping-response', {
        pingLogId: pendingSessionPingId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        capturedAt,
      });
      setPendingSessionPingIdState(null);
      alert(response.data?.message || 'Presença confirmada. O próximo ciclo será calculado automaticamente.');
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
    return (
      <View style={styles.frozenContainer}>
        <Text style={styles.frozenTitle}>Você ainda está no plantão?</Text>
        <Text style={styles.frozenText}>A confirmação é obrigatória para manter sua presença e continuar elegível aos leads.</Text>
        <Text style={styles.frozenText}>Ao confirmar, sua localização será validada por GPS ou Wi-Fi, sem rastreamento contínuo.</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 18, justifyContent: 'center' }}>
          <IconButton
            name="check-circle"
            label={confirmingPresence ? 'Validando...' : 'Sim, no plantão'}
            size="large"
            borderColor={primaryColor}
            loading={confirmingPresence}
            disabled={confirmingPresence}
            onPress={() => void handlePresenceConfirmation(true)}
          />
          <IconButton
            name="log-out"
            label="Fazer checkout"
            size="large"
            borderColor={primaryColor}
            disabled={confirmingPresence}
            onPress={() => void handlePresenceConfirmation(false)}
          />
        </View>
      </View>
    );
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
    return <BoothRulesPanel onBack={() => setCurrentView('main')} primaryColor={primaryColor} />;
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
  // ROTA DO CHECK-IN (CORRETOR SELECIONA O PLANTÃO PARA INICIAR O TURNO)
  // ==========================================
  if (currentView === 'check_in') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <IconButton
            name="arrow-left"
            label="Voltar"
            size="small"
            borderColor="#ffffff"
            color="#ffffff"
            textColor="#ffffff"
            backgroundColor="transparent"
            onPress={() => setCurrentView('main')}
          />
          <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
          <Text style={styles.headerTitle}>Check-in no Plantão</Text>
          <Text style={styles.headerSubtitle}>Selecione o plantão ativo para iniciar o turno</Text>
        </View>
        <ScrollView
          style={styles.dashboardScroll}
          contentContainerStyle={styles.brokerScrollContent}
          showsVerticalScrollIndicator
        >
          <CheckIn
            onCheckInSuccess={(data) => {
              setActiveSession({
                boothName: data?.booth?.name || 'Plantão Ativo',
                checkInAt: new Date(),
              });
              setCurrentView('main');
            }}
          />
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // ROTA DOS MEUS PLANTÕES (ROLETAS DA SEMANA E ELEGIBILIDADE)
  // ==========================================
  if (currentView === 'meus_plantoes') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: primaryColor }]}>
          <IconButton
            name="arrow-left"
            label="Voltar"
            size="small"
            borderColor="#ffffff"
            color="#ffffff"
            textColor="#ffffff"
            backgroundColor="transparent"
            onPress={() => setCurrentView('main')}
          />
          <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
          <Text style={styles.headerTitle}>Meus Plantões</Text>
          <Text style={styles.headerSubtitle}>Roletas da semana e elegibilidade por plantão</Text>
        </View>
        <ScrollView
          style={styles.dashboardScroll}
          contentContainerStyle={styles.brokerScrollContent}
          showsVerticalScrollIndicator
        >
          <View style={styles.brokerPeriodsCard}>
            <Text style={styles.brokerPeriodsTitle}>Minhas Roletas da Semana e Elegibilidade</Text>
            <Text style={[styles.infoText, { color: '#c13a28', fontSize: 12, marginBottom: 8 }]}>
              Contagem semanal (Segunda a Domingo) · Elegibilidade calculada por plantão
            </Text>

            <Text style={styles.infoText}>Total de Roletas cumpridas na semana: <Text style={{ fontWeight: '800' }}>{brokerSummary?.validPeriods ?? 0}</Text></Text>
            {brokerSummary?.invalidatedPeriods > 0 && <Text style={styles.invalidPeriodText}>Roletas incompletas/invalidadas: {brokerSummary.invalidatedPeriods}</Text>}

            {Array.isArray(brokerSummary?.boothsEligibility) && brokerSummary.boothsEligibility.length > 0 && (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={[styles.infoText, { fontWeight: '700', color: '#1c1c1e', marginBottom: 2 }]}>Status por Plantão de Vendas:</Text>
                {brokerSummary.boothsEligibility.map((booth: any) => (
                  <View key={booth.boothId} style={{ backgroundColor: '#fdecea', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#f0b5ab' }}>
                    <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>{booth.boothName}</Text>
                    <Text style={{ fontSize: 13, color: '#c13a28', marginTop: 2 }}>
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
        </ScrollView>
      </View>
    );
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
            <Text style={styles.welcomeSubtitle}>Toque em Check-in para escolher o plantão e iniciar o turno.</Text>

            <View style={styles.iconGrid}>
              <IconButton
                imageSource={APP_ICONS.checkIn}
                label="Check-in e Plantões"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('check_in')}
              />
              <IconButton
                imageSource={APP_ICONS.meusPlantoes}
                label="Meus Plantões"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('meus_plantoes')}
              />
              <IconButton
                imageSource={APP_ICONS.mensagens}
                label="Mensagens / Inbox"
                badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('inbox')}
              />
              <PushSetupButton primaryColor={primaryColor} size="large" />
              <IconButton
                imageSource={APP_ICONS.sair}
                label="Encerrar Sessão"
                size="large"
                borderColor={primaryColor}
                onPress={logout}
              />
            </View>

            <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {pushNotice && <PushToast title={pushNotice.title} body={pushNotice.body} onPress={() => { setPushNotice(null); setCurrentView('inbox'); }} />}
      {operationalNotice && <OperationalAlert title={operationalNotice.title} body={operationalNotice.body} onAcknowledge={() => setOperationalNotice(null)} />}
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

          {/* PRESENÇA SUSPENSA: corretor não confirmou o ping e aguarda revalidação da recepção */}
          {activeSession?.status === 'absent' && (
            <View style={[styles.card, { backgroundColor: '#7c2d12', borderColor: '#b45309', borderWidth: 1 }]}>
              <Text style={{ color: '#fef3c7', fontSize: 15, fontWeight: '800' }}>⚠️ Presença suspensa por ausência</Text>
              <Text style={{ color: '#fed7aa', fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                Você não respondeu à confirmação de permanência e seu turno está em pausa. Se estiver no plantão, solicite a
                validação na recepção. Sua posição na fila da roleta será mantida após a revalidação.
              </Text>
              <TouchableOpacity
                style={{ alignSelf: 'flex-start', backgroundColor: '#b45309', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 }}
                onPress={() => void handleCheckOut()}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Encerrar turno</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* DESTAQUE DA POSIÇÃO NA ROLETA / PÓS-BARRA */}
          <View style={[styles.card, { backgroundColor: '#1c1c1e', borderColor: '#333', borderWidth: 1 }]}>
            {brokerSummary?.activeShift?.attendedAt ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    ✓ ATENDIMENTO REALIZADO
                  </Text>
                  {brokerSummary.activeShift.roletaName ? (
                    <View style={{ backgroundColor: '#14532d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: '#86efac', fontSize: 11, fontWeight: '800' }}>
                        {brokerSummary.activeShift.roletaEntryType === 'pos_barra' ? 'PÓS-BARRA' : brokerSummary.activeShift.roletaName}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginVertical: 4 }}>
                  Você foi atendido na recepção 🎉
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginVertical: 8, gap: 4 }}>
                  <Text style={{ color: '#bbf7d0', fontSize: 12 }}>
                    🕒 Atendimento registrado às: {brokerSummary.activeShift.attendedAt ? new Date(brokerSummary.activeShift.attendedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </Text>
                </View>
                <Text style={{ color: '#c13a28', fontSize: 12, lineHeight: 17 }}>
                  Sua posição na roleta foi concluída. Continue online até o fim do turno para validar a pontualidade e receber novos leads.
                </Text>
              </>
            ) : brokerSummary?.activeShift?.roletaPosition ? (
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
                  🎰 {brokerSummary.activeShift.effectivePosition || brokerSummary.activeShift.roletaPosition}º Lugar na Fila
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginVertical: 8, gap: 4 }}>
                  <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                    🕒 <Text style={{ fontWeight: '700', color: '#fff' }}>Check-in realizado às:</Text> {brokerSummary.activeShift.checkInAtFormatted || '—'}
                  </Text>
                  <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                    🎯 <Text style={{ fontWeight: '700', color: '#fff' }}>Horário do sorteio:</Text> {brokerSummary.activeShift.drawTimeFormatted || '09:01'}
                  </Text>
                  <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                    📌 <Text style={{ fontWeight: '700', color: '#fff' }}>Status:</Text> {brokerSummary.activeShift.roletaEntryType === 'pos_barra' ? 'Atendimento extra / Final da fila' : 'Aguarde ser anunciado na recepção'}
                  </Text>
                </View>
                <Text style={{ color: '#c13a28', fontSize: 12, lineHeight: 17 }}>
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
                  <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                    🕒 <Text style={{ fontWeight: '700', color: '#fff' }}>Check-in registrado às:</Text> {brokerSummary.activeShift.checkInAtFormatted || '—'}
                  </Text>
                  <Text style={{ color: '#facc15', fontSize: 12, fontWeight: '700' }}>
                    🎰 Horário do Sorteio: Às {brokerSummary.activeShift.drawTimeFormatted || '09:01'}
                  </Text>
                  <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                    👥 <Text style={{ fontWeight: '700', color: '#fff' }}>Aguardando no estande:</Text> {brokerSummary.activeShift.waitingBrokersCount || 1} corretor(es)
                  </Text>
                </View>
                <Text style={{ color: '#c13a28', fontSize: 12, lineHeight: 18 }}>
                  O sorteio automático das posições da roleta ocorrerá exatamente às <Text style={{ color: '#fff', fontWeight: '800' }}>{brokerSummary.activeShift.drawTimeFormatted || '09:01'}</Text>. Assim que a roleta girar, esta tela atualizará com sua posição!
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Turno Ativo no Plantão</Text>
                <Text style={{ color: '#c13a28', fontSize: 13 }}>Você está online e apto a receber clientes e leads.</Text>
              </>
            )}
          </View>

          {/* FILA DE ATENDIMENTO DO PLANTÃO AO VIVO */}
          {Array.isArray(brokerSummary?.activeShift?.boothQueue) && brokerSummary.activeShift.boothQueue.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Fila da Roleta no Plantão ({brokerSummary.activeShift.boothQueue.length})</Text>
              <Text style={[styles.infoText, { color: '#c13a28', fontSize: 12, marginBottom: 8 }]}>
                Ordem da roleta para recepção presencial e fila de leads CVCRM
              </Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                {brokerSummary.activeShift.boothQueue.map((item: any) => (
                  <View 
                    key={item.brokerId} 
                    style={[
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 8, borderWidth: 1 },
                      item.isCurrentBroker 
                        ? { backgroundColor: '#fdecea', borderColor: '#3b82f6' } 
                        : { backgroundColor: '#fdecea', borderColor: '#f0b5ab' }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: '#1c1c1e', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{item.effectivePosition || item.roletaPosition || '—'}º</Text>
                      </View>
                      <View>
                        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>
                          {item.nomeGuerra} {item.isCurrentBroker && <Text style={{ color: '#2563eb', fontWeight: '800' }}>(Você)</Text>}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#c13a28' }}>
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
                  <View key={booth.boothId} style={{ backgroundColor: '#fdecea', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#f0b5ab' }}>
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

          <View style={styles.iconGrid}>
            <IconButton
              name="log-out"
              label="Finalizar Turno"
              size="large"
              borderColor={primaryColor}
              loading={endingShift}
              disabled={endingShift}
              onPress={handleCheckOut}
            />
            <IconButton
              imageSource={APP_ICONS.mensagens}
              label="Mensagens / Alertas"
              badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('inbox')}
            />
            <PushSetupButton primaryColor={primaryColor} size="large" />
            <IconButton
              imageSource={APP_ICONS.sair}
              label="Encerrar Sessão"
              size="large"
              borderColor={primaryColor}
              onPress={logout}
            />
          </View>

          <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />
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
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <View style={styles.headerRow}>
          <Text style={styles.tenantName}>{tenant?.name || 'ABIATAR'}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{isManager ? 'Gerência' : isDirector ? 'Diretoria' : isRh ? 'Recursos Humanos (RH)' : 'Administrador'}</Text>
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
          {isManager 
            ? 'Acompanhe sua equipe, os corretores e as comunicações do plantão.' 
            : isRh 
              ? 'Painel de Recursos Humanos: Gestão de carreiras, acompanhamento de estágios e renovação de vigências.'
              : 'Seja bem-vindo à sua área de trabalho administrativa.'}
        </Text>

        {isManager ? (
          <>
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Painel da Gerência</Text>
              <Text style={styles.infoText}>Acompanhe a assiduidade da sua equipe, envie convites, aprove novos corretores e gerencie a distribuição da fila de leads.</Text>
            </View>

            <View style={styles.iconGrid}>
              <IconButton
                imageSource={APP_ICONS.gerenciarEquipes}
                label="Gestão da Minha Equipe"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('manager_panel')}
              />
              <IconButton
                imageSource={APP_ICONS.comunicacaoInstitucional}
                label="Mensagem à Equipe"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('director_messaging')}
              />
              <IconButton
                imageSource={APP_ICONS.mensagens}
                label="Mensagens da Equipe"
                badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('inbox')}
              />
              <PushSetupButton primaryColor={primaryColor} size="large" />
              <IconButton
                imageSource={APP_ICONS.sair}
                label="Encerrar Sessão"
                size="large"
                borderColor={primaryColor}
                onPress={logout}
              />
            </View>
          </>
        ) : isRh ? (
          <>
            <View style={styles.card}>
              <Text style={styles.infoTitle}>Painel de Recursos Humanos (RH)</Text>
              <Text style={styles.infoText}>Acompanhe a evolução de corretores em treinamento, estagiários e CRECI de todas as equipes. Realize upgrades, downgrades e renove prazos de vigência.</Text>
            </View>

            <View style={styles.iconGrid}>
              <IconButton
                imageSource={APP_ICONS.gerenciarEquipes}
                label="Carreiras e Estágios (RH)"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('manager_panel')}
              />
              <IconButton
                imageSource={APP_ICONS.mensagens}
                label="Mensagens / Alertas"
                badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('inbox')}
              />
              <PushSetupButton primaryColor={primaryColor} size="large" />
              <IconButton
                imageSource={APP_ICONS.sair}
                label="Encerrar Sessão"
                size="large"
                borderColor={primaryColor}
                onPress={logout}
              />
            </View>
          </>
        ) : (
          <View style={styles.iconGrid}>
            <IconButton
              imageSource={APP_ICONS.administrarPlantoes}
              label="Administrar Plantões e Regras"
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('booth_rules')}
            />
            <IconButton
              imageSource={APP_ICONS.inteligenciaBi}
              label="Inteligência de Plantão (BI)"
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('statistics')}
            />
            <IconButton
              imageSource={APP_ICONS.gerenciarEquipes}
              label="Gerenciar Corretores / Equipe"
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('manager_panel')}
            />
            <IconButton
              imageSource={APP_ICONS.comunicacaoInstitucional}
              label="Comunicação Institucional"
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('director_messaging')}
            />
            {canManageUsers && (
              <IconButton
                imageSource={APP_ICONS.gerenciarGerentesRecepcao}
                label="Gerenciar Gerentes e Recepção"
                size="large"
                borderColor={primaryColor}
                onPress={() => setCurrentView('user_management')}
              />
            )}
            <IconButton
              imageSource={APP_ICONS.mensagens}
              label="Mensagens / Alertas"
              badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : null}
              size="large"
              borderColor={primaryColor}
              onPress={() => setCurrentView('inbox')}
            />
            <PushSetupButton primaryColor={primaryColor} size="large" />
            <IconButton
              imageSource={APP_ICONS.sair}
              label="Encerrar Sessão"
              size="large"
              borderColor={primaryColor}
              onPress={logout}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ frozenContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff7ed' }, frozenTitle: { fontSize: 26, fontWeight: '800', color: '#9a3412', textAlign: 'center', marginVertical: 14 }, frozenText: { maxWidth: 520, color: '#7c2d12', textAlign: 'center', lineHeight: 22, marginBottom: 10 }, frozenButton: { width: '100%', maxWidth: 520, minHeight: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 18 }, frozenButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 }, frozenNoButton: { width: '100%', maxWidth: 520, minHeight: 50, borderWidth: 1, borderColor: '#9a3412', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, frozenNoText: { color: '#9a3412', fontWeight: '800' },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 16,
    width: '100%',
    maxWidth: 520,
    marginVertical: 14,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#fdecea',
  },
  centerContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdecea',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#c13a28',
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
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#c13a28',
    fontSize: 13,
    marginTop: 3,
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
    color: '#c13a28',
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
    borderColor: '#f0b5ab',
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
    color: '#c13a28',
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
  brokerPeriodsCard: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0b5ab' },
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
    backgroundColor: '#fdecea',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0b5ab',
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
