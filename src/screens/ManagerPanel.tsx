// src/screens/ManagerPanel.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList, 
  Platform,
  ScrollView 
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';
import BrokerManagementPanel from './BrokerManagementPanel';

interface PendingBroker {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci: string;
}

interface TeamMember {
  id: string;
  name: string;
  nome_guerra: string;
  status: string;
  carencia_ends_at: string | null;
}

// Interface de tipagem estrita para a fila de leads em tempo real
interface LeadsQueueItem {
  brokerId: string;
  nomeGuerra: string;
  managerName: string;
  statusPresenca: string;
  statusCarencia: string;
  isHabilitado: string;
  dataAtualizacao: string;
}

interface ManagerPanelProps {
  onBack: () => void;
}

export default function ManagerPanel({ onBack }: ManagerPanelProps) {
  const { user, tenant } = useAuth();
  const [pending, setPending] = useState<PendingBroker[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [leadsQueue, setLeadsQueue] = useState<LeadsQueueItem[]>([]); // <-- ADICIONADO ESTADO DA FILA
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState<'gerencia_level_2' | 'corretor_level_3'>('corretor_level_3');
  const [managers, setManagers] = useState<Array<{ id: string; nome_guerra: string; name: string }>>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [error, setError] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);

  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const managerId = user?.id || '';
  const isDirector = user?.role === 'diretoria_level_1';

  // 1. Efeito Inicial: Carrega todas as filas e a distribuição de leads ao vivo em paralelo
  const loadData = async () => {
    try {
      setError('');
      const requests: Promise<any>[] = [
        user?.role === 'gerencia_level_2' ? api.get(`/users/pending/${managerId}`) : Promise.resolve({ data: [] }),
        isDirector ? api.get('/users/active-brokers') : api.get(`/users/team/${managerId}`),
        api.get('/users/leads-queue'),
      ];
      if (user?.role === 'diretoria_level_1') requests.push(api.get('/users/managers/active'));
      const [pendingRes, teamRes, queueRes, managersRes] = await Promise.all(requests);
      setPending(pendingRes.data);
      setTeam(teamRes.data);
      setLeadsQueue(queueRes.data.queue);
      if (managersRes) {
        setManagers(Array.isArray(managersRes.data) ? managersRes.data : []);
        if (!selectedManagerId && managersRes.data?.[0]) setSelectedManagerId(managersRes.data[0].id);
      }
    } catch (err: any) {
      setError('Falha ao carregar os dados de gestão do time.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [managerId]);

  // 2. Método para o Gerente gerar um novo link de convite único
  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      if (user?.role === 'diretoria_level_1' && inviteRole === 'corretor_level_3' && !selectedManagerId) {
        alert('Selecione um Gerente responsável antes de convidar um Corretor.');
        return;
      }
      const response = await api.post('/users/onboarding-link', {
        invitedRole: inviteRole,
        managerId: user?.role === 'gerencia_level_2' ? managerId : (inviteRole === 'corretor_level_3' ? selectedManagerId : undefined),
      });
      setInviteLink(response.data.onboarding_url);
    } catch (err: any) {
      alert('Falha ao gerar link de convite.');
    } finally {
      setGeneratingLink(false);
    }
  };

  // Copia o link de onboarding gerado
  const handleCopyLink = async () => {
    if (!inviteLink) return;

    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(inviteLink);
      alert('Link de convite copiado! Cole no WhatsApp do corretor.');
    } else {
      alert(`Copie o link: ${inviteLink}`);
    }
  };

  // Copia o Nome de Guerra do corretor habilitado com um clique para facilitar a distribuição
  const handleCopyBrokerName = async (nomeGuerra: string) => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(nomeGuerra);
      alert(`Nome "${nomeGuerra}" copiado com sucesso para a área de transferência!`);
    } else {
      alert(`Corretor: ${nomeGuerra}`);
    }
  };

  // 3. Método para Aprovar o Corretor definindo a Carência (A: 7 dias, B: 15 dias, C: 30 dias)
  const handleApprove = async (brokerId: string, days: number) => {
    try {
      setApprovingId(brokerId);
      await api.patch(`/users/${brokerId}/approve`, {
        carenciaDays: days,
      });

      alert('Corretor aprovado e ativado com sucesso!');
      loadData(); // Recarrega todas as informações atualizadas
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao aprovar corretor.');
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Carregando painel do time...</Text>
      </View>
    );
  }

  return (
    <>
      <BrokerManagementPanel
        brokerId={selectedBrokerId}
        isDirector={isDirector}
        managers={managers}
        onClose={() => setSelectedBrokerId(null)}
        onSaved={() => { void loadData(); }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <ScreenCode code="GE-02" />
      <TouchableOpacity style={styles.backHeader} onPress={onBack}>
        <Text style={[styles.backHeaderText, { color: primaryColor }]}>← Voltar ao Painel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Gestão de Corretores</Text>
      <Text style={styles.subtitle}>Gerencie convites, cadastros, aprovações e distribuição de leads</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* SEÇÃO A: GERAR CONVITES DE CADASTRO */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{user?.role === 'diretoria_level_1' ? 'Convites Hierárquicos' : 'Convide Novos Corretores'}</Text>
        <Text style={styles.sectionDesc}>Gere um link temporário único. O aceite será vinculado automaticamente à hierarquia correta.</Text>
        {user?.role === 'diretoria_level_1' && (
          <>
            <Text style={styles.actionLabel}>Tipo de convite</Text>
            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.roleButton, inviteRole === 'gerencia_level_2' && styles.roleButtonActive]} onPress={() => setInviteRole('gerencia_level_2')}><Text style={inviteRole === 'gerencia_level_2' ? styles.roleButtonTextActive : styles.roleButtonText}>Gerente</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, inviteRole === 'corretor_level_3' && styles.roleButtonActive]} onPress={() => setInviteRole('corretor_level_3')}><Text style={inviteRole === 'corretor_level_3' ? styles.roleButtonTextActive : styles.roleButtonText}>Corretor</Text></TouchableOpacity>
            </View>
            {inviteRole === 'corretor_level_3' && (
              <>
                <Text style={styles.actionLabel}>Gerente responsável obrigatório</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managerPicker}>
                  {managers.map((manager) => (
                    <TouchableOpacity key={manager.id} style={[styles.managerButton, selectedManagerId === manager.id && styles.managerButtonActive]} onPress={() => setSelectedManagerId(manager.id)}>
                      <Text style={selectedManagerId === manager.id ? styles.managerButtonTextActive : styles.managerButtonText}>{manager.nome_guerra || manager.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {!managers.length && <Text style={styles.emptyText}>Nenhum gerente ativo disponível.</Text>}
              </>
            )}
          </>
        )}
        
        {inviteLink ? (
          <View style={styles.linkContainer}>
            <Text style={styles.linkLabel} numberOfLines={1}>{inviteLink}</Text>
            <TouchableOpacity 
              style={[styles.copyButton, { backgroundColor: primaryColor }]} 
              onPress={handleCopyLink}
            >
              <Text style={styles.copyButtonText}>Copiar Link</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.generateButton, { backgroundColor: primaryColor }]} 
            onPress={handleGenerateLink}
            disabled={generatingLink}
          >
            {generatingLink ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.generateButtonText}>Gerar Novo Link de Cadastro</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* NOVA SEÇÃO B: FILA DE DISTRIBUIÇÃO DE LEADS AO VIVO (REAL-TIME) */}
      <Text style={styles.subHeader}>Fila de Leads Ativa (Tempo Real)</Text>
      <FlatList
        data={leadsQueue}
        keyExtractor={(item) => item.brokerId}
        style={styles.list}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhum corretor cadastrado no sistema.</Text>
        }
        renderItem={({ item }) => {
          const isHabilitado = item.isHabilitado.includes('HABILITADO');
          return (
            <View style={[styles.queueCard, isHabilitado ? { borderColor: '#34c759', borderWidth: 1 } : null]}>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                <Text style={styles.queueSub}>Gerente: {item.managerName}</Text>
                <Text style={styles.queueSub}>Presença: {item.statusPresenca}</Text>
                <Text style={styles.queueSub}>Carência: {item.statusCarencia}</Text>
              </View>

              <View style={styles.queueAction}>
                <Text style={[styles.statusBadge, { color: isHabilitado ? '#34c759' : '#ff3b30' }]}>
                  {item.isHabilitado}
                </Text>
                {isHabilitado && (
                  <TouchableOpacity 
                    style={[styles.copyNameBtn, { backgroundColor: primaryColor }]}
                    onPress={() => handleCopyBrokerName(item.nomeGuerra)}
                  >
                    <Text style={styles.copyNameBtnText}>Copiar Nome</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {!isDirector && <>
        {/* SEÇÃO C: FILA DE APROVAÇÕES PENDENTES */}
        <Text style={styles.subHeader}>Aprovações Pendentes ({pending.length})</Text>
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          style={styles.list}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum corretor aguardando aprovação.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.brokerCard} activeOpacity={0.8} onPress={() => setSelectedBrokerId(item.id)}>
              <View style={styles.brokerInfo}>
                <Text style={styles.brokerName}>{item.name}</Text>
                <Text style={styles.brokerSub}>Nome de Guerra: {item.nome_guerra}</Text>
                <Text style={styles.brokerSub}>E-mail: {item.email}</Text>
                <Text style={styles.brokerSub}>CRECI: {item.creci}</Text>
              </View>

              {approvingId === item.id ? (
                <ActivityIndicator color={primaryColor} />
              ) : (
                <View style={styles.actionContainer}>
                  <Text style={styles.actionLabel}>Aprovar Corretor:</Text>
                  <View style={styles.buttonGroup}>
                    <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#15803d' }]} onPress={() => handleApprove(item.id, 0)}>
                      <Text style={styles.approveBtnText}>Sem carência</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#34c759' }]} onPress={() => handleApprove(item.id, 7)}>
                      <Text style={styles.approveBtnText}>7 Dias</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#ff9500' }]} onPress={() => handleApprove(item.id, 15)}>
                      <Text style={styles.approveBtnText}>15 Dias</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#ff3b30' }]} onPress={() => handleApprove(item.id, 30)}>
                      <Text style={styles.approveBtnText}>30 Dias</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </>}

      {/* SEÇÃO D: FILA DE EQUIPE ATIVA ATUAL */}
      <Text style={styles.subHeader}>Time Ativo e em Carência ({team.length})</Text>
      <FlatList
        data={team}
        keyExtractor={(item) => item.id}
        style={styles.list}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Sua equipe de vendas está vazia no momento.</Text>
        }
        renderItem={({ item }) => {
          const isGrace = item.status === 'grace_period';
          return (
            <TouchableOpacity style={styles.teamCard} activeOpacity={0.8} onPress={() => setSelectedBrokerId(item.id)}>
              <View>
                <Text style={styles.teamName}>{item.name} ({item.nome_guerra})</Text>
                {isGrace && item.carencia_ends_at ? (
                  <Text style={styles.carenciaLabel}>
                    Carência ativa até: {new Date(item.carencia_ends_at).toLocaleDateString('pt-BR')}
                  </Text>
                ) : (
                  <Text style={styles.activeLabel}>🟢 Liberado no CVCRM (Recebendo Leads)</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      </ScrollView>
    </>
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
    color: '#4b5563',
    marginBottom: 32,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 16,
    marginTop: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  sectionCard: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 16,
  },
  roleButton: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 },
  roleButtonActive: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  roleButtonText: { color: '#1f2937', fontWeight: '700' },
  roleButtonTextActive: { color: '#FFFFFF', fontWeight: '800' },
  managerPicker: { marginBottom: 12 },
  managerButton: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 8, padding: 10, marginRight: 8 },
  managerButtonActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  managerButtonText: { color: '#1e3a8a', fontWeight: '700' },
  managerButtonTextActive: { color: '#FFFFFF', fontWeight: '800' },
  generateButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafc',
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 8,
    paddingLeft: 12,
    height: 46,
  },
  linkLabel: {
    flex: 1,
    fontSize: 14,
    color: '#3a3a3c',
    paddingRight: 8,
  },
  copyButton: {
    height: 46,
    paddingHorizontal: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  brokerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  brokerInfo: {
    marginBottom: 16,
  },
  brokerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  brokerSub: {
    fontSize: 13,
    color: '#3a3a3c',
    marginBottom: 2,
  },
  actionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
    paddingTop: 12,
  },
  actionLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approveBtn: {
    flex: 1,
    minWidth: 88,
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  teamCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  carenciaLabel: {
    fontSize: 13,
    color: '#ff9500',
    fontWeight: '600',
  },
  activeLabel: {
    fontSize: 13,
    color: '#34c759',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  queueCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  queueInfo: {
    flex: 1,
  },
  queueName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  queueSub: {
    fontSize: 13,
    color: '#3a3a3c',
    marginBottom: 2,
  },
  queueAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 0,
    marginTop: 12,
    width: '100%',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 0,
    textTransform: 'uppercase',
  },
  copyNameBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyNameBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});