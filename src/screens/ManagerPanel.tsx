// src/screens/ManagerPanel.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  FlatList, 
  Platform,
  ScrollView,
  TextInput,
  Modal
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';
import BrokerManagementPanel from './BrokerManagementPanel';

interface BrokerItem {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci?: string;
  status: string;
  broker_stage?: 'treinamento' | 'estagiario' | 'corretor_creci';
  manager_id?: string | null;
  carencia_ends_at?: string | null;
  stage_expires_at?: string | null;
  days_until_stage_expiry?: number | null;
  is_stage_expired?: boolean;
  last_checkin_at?: string | null;
  days_since_last_checkin?: number | null;
  is_inactive_90d?: boolean;
  suspension_reason?: string | null;
  is_suspended?: boolean;
}

interface PendingBroker {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci: string;
  broker_stage?: 'treinamento' | 'estagiario' | 'corretor_creci';
}

interface LeadsQueueItem {
  brokerId: string;
  nomeGuerra: string;
  managerName: string;
  statusPresenca: string;
  statusCarencia: string;
  isHabilitado: string;
  roletaPosition?: number | null;
  roletaEntryType?: string | null;
  minutesActive?: number;
  minimumRequiredMinutes?: number;
  dataAtualizacao: string;
}

interface ManagerItem {
  id: string;
  nome_guerra: string;
  name: string;
  email?: string;
}

interface ManagerPanelProps {
  onBack: () => void;
}

export default function ManagerPanel({ onBack }: ManagerPanelProps) {
  const { user, tenant } = useAuth();
  const [allBrokers, setAllBrokers] = useState<BrokerItem[]>([]);
  const [pending, setPending] = useState<PendingBroker[]>([]);
  const [team, setTeam] = useState<BrokerItem[]>([]);
  const [leadsQueue, setLeadsQueue] = useState<LeadsQueueItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [boothsCount, setBoothsCount] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState<'gerencia_level_2' | 'corretor_level_3'>('corretor_level_3');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [error, setError] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);

  // Estados exclusivos do modo Diretoria (Hierárquico / Drill-Down)
  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});
  const [teamEligibility, setTeamEligibility] = useState<any | null>(null);

  // Estados de Triagem Documental do RH / Diretoria
  const [pendingHrReview, setPendingHrReview] = useState<any[]>([]);
  const [editingCandidate, setEditingCandidate] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editNomeGuerra, setEditNomeGuerra] = useState('');
  const [editCreci, setEditCreci] = useState('');
  const [editStage, setEditStage] = useState<'treinamento' | 'estagiario' | 'corretor_creci'>('treinamento');
  const [editManagerId, setEditManagerId] = useState('');
  const [processingCandidateId, setProcessingCandidateId] = useState<string | null>(null);

  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const managerId = user?.id || '';
  const isDirector = user?.role === 'diretoria_level_1' || user?.role === 'platform_admin_level_0';
  const isRh = user?.role === 'rh_level_2' || user?.role === 'rh_level_1';
  const isDirectorOrRh = isDirector || isRh;

  const loadData = async () => {
    try {
      setError('');
      if (isDirectorOrRh) {
        // Modo Diretoria / RH: busca Gerentes, todos os Corretores, Plantões e Triagem Documental
        const [managersRes, brokersRes, boothsRes, hrReviewRes] = await Promise.all([
          api.get('/users/managers/active'),
          api.get('/users/active-brokers', { params: { pageSize: 500 } }),
          api.get('/booths'),
          api.get('/users/pending-hr-review').catch(() => ({ data: [] })),
        ]);

        const managersData = Array.isArray(managersRes.data) ? managersRes.data : [];
        const brokersData = Array.isArray(brokersRes.data) ? brokersRes.data : (brokersRes.data?.data || []);
        const boothsData = Array.isArray(boothsRes.data) ? boothsRes.data : [];
        const hrReviewData = Array.isArray(hrReviewRes.data) ? hrReviewRes.data : [];

        setManagers(managersData);
        setAllBrokers(brokersData);
        setBoothsCount(boothsData.length);
        setPendingHrReview(hrReviewData);

        if (!selectedManagerId && managersData[0]) {
          setSelectedManagerId(managersData[0].id);
        }
      } else {
        // Modo Gerente: busca pendentes, time próprio, fila de leads e elegibilidade da equipe
        const [pendingRes, teamRes, queueRes, eligibilityRes] = await Promise.all([
          api.get(`/users/pending/${managerId}`),
          api.get(`/users/team/${managerId}`, { params: { pageSize: 200 } }),
          api.get('/users/leads-queue'),
          api.get('/presences/team-eligibility').catch(() => ({ data: null })),
        ]);

        setPending(Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data?.data || []));
        setTeam(Array.isArray(teamRes.data) ? teamRes.data : (teamRes.data?.data || []));
        setLeadsQueue(queueRes.data.queue || []);
        if (eligibilityRes?.data) setTeamEligibility(eligibilityRes.data);
      }
    } catch (err: any) {
      setError('Falha ao carregar os dados operacionais.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveByHr = async (candidate: any) => {
    try {
      setProcessingCandidateId(candidate.id);
      setError('');
      const res = await api.patch(`/users/${candidate.id}/hr-approve`);
      alert(res.data?.message || `Documentação de ${candidate.nome_guerra} aprovada! O corretor foi encaminhado para a Gerência.`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao aprovar documentação.');
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const handleOpenEditCandidate = (candidate: any) => {
    setEditingCandidate(candidate);
    setEditName(candidate.name || '');
    setEditNomeGuerra(candidate.nome_guerra || '');
    setEditCreci(candidate.creci || '');
    setEditStage(candidate.broker_stage || 'treinamento');
    setEditManagerId(candidate.manager_id || (managers[0]?.id || ''));
  };

  const handleSaveEditCandidate = async () => {
    if (!editingCandidate) return;
    if (!editNomeGuerra.trim()) {
      alert('Nome de Guerra é obrigatório.');
      return;
    }
    try {
      setProcessingCandidateId(editingCandidate.id);
      setError('');
      await api.patch(`/users/${editingCandidate.id}/hr-update`, {
        name: editName.trim(),
        nomeGuerra: editNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        creci: editCreci.trim() ? editCreci.trim().toUpperCase() : null,
        brokerStage: editStage,
        managerId: editManagerId || undefined,
      });
      alert('Dados do candidato atualizados com sucesso!');
      setEditingCandidate(null);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao atualizar dados.');
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const handleHardDeleteCandidate = async (candidate: any) => {
    const confirmed = typeof window === 'undefined' ? true : window.confirm(
      `Excluir DEFINITIVAMENTE o cadastro de ${candidate.nome_guerra}?\n\nEsta ação apagará o cadastro e LIBERARÁ o Nome de Guerra e o E-mail imediatamente para novo uso.`
    );
    if (!confirmed) return;

    try {
      setProcessingCandidateId(candidate.id);
      setError('');
      const res = await api.delete(`/users/${candidate.id}/hard-delete`);
      alert(res.data?.message || 'Cadastro excluído com sucesso.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao excluir cadastro.');
    } finally {
      setProcessingCandidateId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [managerId, isDirector]);

  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      if (isDirector && inviteRole === 'corretor_level_3' && !selectedManagerId) {
        alert('Selecione um Gerente responsável antes de convidar um Corretor.');
        return;
      }
      const response = await api.post('/users/onboarding-link', {
        invitedRole: inviteRole,
        managerId: isDirector ? (inviteRole === 'corretor_level_3' ? selectedManagerId : undefined) : managerId,
      });
      const token = response.data.token;
      const origin = (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://abiatar.bitimob.com.br';
      const formattedUrl = token ? `${origin}/cadastro/${token}` : response.data.onboarding_url;
      setInviteLink(formattedUrl);
    } catch (err: any) {
      alert('Falha ao gerar link de convite.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(inviteLink);
      alert('Link de convite copiado para a área de transferência!');
    } else {
      alert(`Copie o link: ${inviteLink}`);
    }
  };

  const handleCopyBrokerName = async (nomeGuerra: string) => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(nomeGuerra);
      alert(`Nome "${nomeGuerra}" copiado com sucesso!`);
    } else {
      alert(`Corretor: ${nomeGuerra}`);
    }
  };

  const handleApprove = async (brokerId: string, days: number) => {
    try {
      setApprovingId(brokerId);
      await api.patch(`/users/${brokerId}/approve`, { carenciaDays: days });
      alert('Corretor aprovado e ativado com sucesso!');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao aprovar corretor.');
    } finally {
      setApprovingId(null);
    }
  };

  const toggleManagerAccordion = (mId: string) => {
    setExpandedManagers((prev) => ({ ...prev, [mId]: !prev[mId] }));
  };

  // Agrupamento de corretores por gerente para o Diretor
  const brokersByManager = useMemo(() => {
    const map: Record<string, BrokerItem[]> = {};
    managers.forEach((m) => { map[m.id] = []; });
    map['unassigned'] = [];

    allBrokers.forEach((broker) => {
      if (broker.manager_id && map[broker.manager_id]) {
        map[broker.manager_id].push(broker);
      } else {
        map['unassigned'].push(broker);
      }
    });
    return map;
  }, [allBrokers, managers]);

  // Busca global instantânea de corretor
  const searchFilteredBrokers = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return allBrokers.filter((b) => 
      b.name.toLowerCase().includes(q) ||
      b.nome_guerra.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      (b.creci && b.creci.toLowerCase().includes(q))
    );
  }, [allBrokers, globalSearch]);

  const totalActiveBrokers = useMemo(() => allBrokers.filter((b) => b.status === 'active').length, [allBrokers]);
  const totalGraceBrokers = useMemo(() => allBrokers.filter((b) => b.status === 'grace_period').length, [allBrokers]);

  const renderStageBadge = (broker: any) => {
    const isSuspended = broker?.is_suspended || broker?.is_stage_expired || broker?.is_inactive_90d;
    if (isSuspended) {
      return (
        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#fca5a5' }}>
          <Text style={{ color: '#b91c1c', fontSize: 11, fontWeight: '800' }}>
            🔴 SUSPENSO ({broker?.suspension_reason || 'Vencido'})
          </Text>
        </View>
      );
    }

    const stage = typeof broker === 'string' ? broker : broker?.broker_stage;
    const days = typeof broker === 'object' ? broker?.days_until_stage_expiry : null;

    switch (stage) {
      case 'treinamento':
        return (
          <View style={styles.badgeTreinamento}>
            <Text style={styles.badgeTextTreinamento}>
              🔵 Treinamento {days !== null && days !== undefined ? `(${days}d)` : '(90d)'}
            </Text>
          </View>
        );
      case 'estagiario':
        return (
          <View style={styles.badgeEstagiario}>
            <Text style={styles.badgeTextEstagiario}>
              🟡 Estagiário {days !== null && days !== undefined ? `(${days}d)` : '(6m)'}
            </Text>
          </View>
        );
      case 'corretor_creci':
      default:
        return (
          <View style={styles.badgeCreci}>
            <Text style={styles.badgeTextCreci}>🟢 Corretor CRECI</Text>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Carregando estrutura de corretores...</Text>
      </View>
    );
  }

  return (
    <>
      {/* MODAL DE AJUSTE DE CADASTRO NA TRIAGEM */}
      {editingCandidate && (
        <Modal visible={!!editingCandidate} transparent animationType="fade" onRequestClose={() => setEditingCandidate(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '90%' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                ✏️ Ajustar Cadastro na Triagem
              </Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Faça as correções cadastrais necessárias antes de encaminhar para a Gerência.
              </Text>

              <ScrollView style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nome Completo"
                />

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Nome de Guerra *</Text>
                <TextInput
                  style={styles.input}
                  value={editNomeGuerra}
                  onChangeText={(v) => setEditNomeGuerra(v.toLocaleUpperCase('pt-BR'))}
                  placeholder="NOME DE GUERRA"
                  autoCapitalize="characters"
                />

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Estágio Profissional</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[styles.stageSelectBtn, editStage === 'treinamento' && styles.stageSelectBtnActive]}
                    onPress={() => setEditStage('treinamento')}
                  >
                    <Text style={editStage === 'treinamento' ? styles.stageSelectTextActive : styles.stageSelectText}>🔵 Treinamento</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.stageSelectBtn, editStage === 'estagiario' && styles.stageSelectBtnActive]}
                    onPress={() => setEditStage('estagiario')}
                  >
                    <Text style={editStage === 'estagiario' ? styles.stageSelectTextActive : styles.stageSelectText}>🟡 Estagiário</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.stageSelectBtn, editStage === 'corretor_creci' && styles.stageSelectBtnActive]}
                    onPress={() => setEditStage('corretor_creci')}
                  >
                    <Text style={editStage === 'corretor_creci' ? styles.stageSelectTextActive : styles.stageSelectText}>🟢 Corretor CRECI</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Número do CRECI</Text>
                <TextInput
                  style={styles.input}
                  value={editCreci}
                  onChangeText={(v) => setEditCreci(v.toUpperCase())}
                  placeholder="Ex: 123456-F"
                  autoCapitalize="characters"
                />

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 }}>Gerente Responsável</Text>
                <select
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    marginBottom: '10px',
                    backgroundColor: '#f8fafc',
                  }}
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      Gerente {m.nome_guerra || m.name} ({m.name})
                    </option>
                  ))}
                </select>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, backgroundColor: '#f1f5f9' }}
                  onPress={() => setEditingCandidate(null)}
                  disabled={!!processingCandidateId}
                >
                  <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6, backgroundColor: '#2563eb' }}
                  onPress={handleSaveEditCandidate}
                  disabled={!!processingCandidateId}
                >
                  {processingCandidateId ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Salvar Ajustes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <BrokerManagementPanel
        brokerId={selectedBrokerId}
        isDirector={isDirector}
        isRh={isRh}
        managers={managers}
        onClose={() => setSelectedBrokerId(null)}
        onSaved={() => { void loadData(); }}
      />
    <View style={styles.container}>
      <ScreenCode code={isRh ? 'RH-02' : isDirector ? 'DR-01' : 'GE-02'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Voltar ao Painel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isRh ? 'Gestão de Estágios e Carreiras (RH)' : isDirector ? 'Gestão Executiva de Corretores' : 'Gestão de Corretores'}</Text>
        <Text style={styles.headerSubtitle}>
          {isRh
            ? 'Acompanhamento de corretores, evolução de estágios e renovação de vigências'
            : isDirector 
              ? 'Visão hierárquica por equipe de gerência e ações operacionais' 
              : 'Gerencie convites, aprovações de cadastro e distribuição de leads'}
        </Text>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* MODO DIRETORIA / RH: CARDS DE KPI DE ALTO NÍVEL */}
        {isDirectorOrRh && (
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{allBrokers.length}</Text>
              <Text style={styles.kpiLabel}>Total Corretores</Text>
              <Text style={styles.kpiSub}>({totalActiveBrokers} ativos · {totalGraceBrokers} carência)</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{managers.length}</Text>
              <Text style={styles.kpiLabel}>Gerências</Text>
              <Text style={styles.kpiSub}>Equipes ativas</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{boothsCount}</Text>
              <Text style={styles.kpiLabel}>Plantões</Text>
              <Text style={styles.kpiSub}>Estandes de venda</Text>
            </View>
          </View>
        )}

        {/* MODO DIRETORIA / RH: FILA DE TRIAGEM DOCUMENTAL DE NOVOS CADASTROS */}
        {isDirectorOrRh && (
          <View style={[styles.sectionCard, { borderColor: '#3b82f6', borderWidth: 1.5 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[styles.sectionTitle, { color: '#1d4ed8', marginBottom: 0 }]}>
                📑 Triagem Documental de Novos Cadastros ({pendingHrReview.length})
              </Text>
              {pendingHrReview.length > 0 && (
                <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#1e40af', fontWeight: '800', fontSize: 12 }}>Aguardando RH</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionDesc}>
              Corretores que enviaram cadastro público com documentos. Valide os dados e aprove para liberar o cadastro para o Gerente responsável.
            </Text>

            {pendingHrReview.length === 0 ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={styles.emptyText}>Nenhum corretor aguardando triagem documental no momento.</Text>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {pendingHrReview.map((candidate) => (
                  <View key={candidate.id} style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#cbd5e1' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ flex: 1, minWidth: 220 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{candidate.nome_guerra}</Text>
                          <Text style={{ fontSize: 13, color: '#64748b' }}>({candidate.name})</Text>
                          {renderStageBadge(candidate)}
                        </View>
                        <Text style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                          📧 {candidate.email} · CRECI: <Text style={{ fontWeight: '600' }}>{candidate.creci || '—'}</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                          👤 Gerente Indicado: <Text style={{ fontWeight: '700' }}>Gerente {candidate.manager_nome_guerra || 'Sem gerente'}</Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          🕒 Enviado em: {new Date(candidate.created_at).toLocaleString('pt-BR')}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          style={{ backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }}
                          onPress={() => handleApproveByHr(candidate)}
                          disabled={processingCandidateId === candidate.id}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>✓ Aprovar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 }}
                          onPress={() => handleOpenEditCandidate(candidate)}
                          disabled={processingCandidateId === candidate.id}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>✏️ Ajustar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6 }}
                          onPress={() => handleHardDeleteCandidate(candidate)}
                          disabled={processingCandidateId === candidate.id}
                        >
                          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>🗑️ Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* SEÇÃO: GERAR CONVITES DE CADASTRO */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{isDirector ? 'Gerar Convite de Acesso' : 'Convide Novos Corretores'}</Text>
          <Text style={styles.sectionDesc}>Gere links de convite únicos vinculados automaticamente à hierarquia.</Text>
          {isDirector && (
            <>
              <Text style={styles.actionLabel}>Tipo de convite</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity style={[styles.roleButton, inviteRole === 'gerencia_level_2' && styles.roleButtonActive]} onPress={() => setInviteRole('gerencia_level_2')}>
                  <Text style={inviteRole === 'gerencia_level_2' ? styles.roleButtonTextActive : styles.roleButtonText}>Gerente</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleButton, inviteRole === 'corretor_level_3' && styles.roleButtonActive]} onPress={() => setInviteRole('corretor_level_3')}>
                  <Text style={inviteRole === 'corretor_level_3' ? styles.roleButtonTextActive : styles.roleButtonText}>Corretor</Text>
                </TouchableOpacity>
              </View>
              {inviteRole === 'corretor_level_3' && (
                <>
                  <Text style={styles.actionLabel}>Vincular ao Gerente responsável:</Text>
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
              <TouchableOpacity style={[styles.copyButton, { backgroundColor: primaryColor }]} onPress={handleCopyLink}>
                <Text style={styles.copyButtonText}>Copiar Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.generateButton, { backgroundColor: primaryColor }]} onPress={handleGenerateLink} disabled={generatingLink}>
              {generatingLink ? <ActivityIndicator color="#FFF" /> : <Text style={styles.generateButtonText}>Gerar Link de Cadastro</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* MODO DIRETORIA / RH: BUSCA GLOBAL + GUARDA-CHUVAS DE GERÊNCIA */}
        {isDirectorOrRh && (
          <View style={styles.directorSection}>
            <Text style={styles.subHeader}>Busca Global de Corretor</Text>
            <TextInput
              style={styles.globalSearchInput}
              placeholder="🔍 Digite Nome, Nome de Guerra ou CRECI..."
              value={globalSearch}
              onChangeText={setGlobalSearch}
            />

            {/* SE HOUVER BUSCA ATIVA, MOSTRA OS RESULTADOS DIRETOS */}
            {globalSearch.trim().length > 0 ? (
              <View style={styles.searchResultsBox}>
                <Text style={styles.searchResultsCount}>
                  {searchFilteredBrokers.length} corretor(es) encontrado(s):
                </Text>
                {searchFilteredBrokers.map((broker) => {
                  const mgr = managers.find((m) => m.id === broker.manager_id);
                  const isGrace = broker.status === 'grace_period';
                  return (
                    <TouchableOpacity 
                      key={broker.id} 
                      style={styles.searchResultCard}
                      onPress={() => setSelectedBrokerId(broker.id)}
                    >
                      <View style={styles.brokerMainInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.brokerTitle}>
                            {broker.nome_guerra} <Text style={styles.brokerRealName}>({broker.name})</Text>
                          </Text>
                          {renderStageBadge(broker)}
                        </View>
                        <Text style={styles.brokerMeta}>
                          Gerente: <Text style={styles.boldText}>{mgr?.nome_guerra || mgr?.name || 'Não vinculado'}</Text> · CRECI: {broker.creci || '—'}
                        </Text>
                      </View>
                      <View style={styles.brokerRightBadge}>
                        <Text style={[styles.statusTag, isGrace ? styles.statusGrace : styles.statusActive]}>
                          {isGrace ? 'Carência' : 'Ativo'}
                        </Text>
                        <Text style={styles.actionPromptText}>Abrir Card →</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {searchFilteredBrokers.length === 0 && (
                  <Text style={styles.emptyText}>Nenhum corretor encontrado com este termo.</Text>
                )}
              </View>
            ) : (
              /* SE NÃO HOUVER BUSCA, EXIBE O AGRUPAMENTO HIERÁRQUICO POR GERÊNCIA */
              <View style={styles.managerListSection}>
                <Text style={styles.subHeader}>Equipes por Gerência ({managers.length})</Text>
                <Text style={styles.sectionDescHeader}>Clique na equipe para expandir e gerenciar os corretores vinculados.</Text>

                {managers.map((mgr) => {
                  const teamMembers = brokersByManager[mgr.id] || [];
                  const activeCount = teamMembers.filter((b) => b.status === 'active').length;
                  const graceCount = teamMembers.filter((b) => b.status === 'grace_period').length;
                  const isExpanded = Boolean(expandedManagers[mgr.id]);

                  return (
                    <View key={mgr.id} style={styles.managerAccordionCard}>
                      <TouchableOpacity 
                        style={styles.managerAccordionHeader}
                        onPress={() => toggleManagerAccordion(mgr.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.managerHeaderInfo}>
                          <Text style={styles.managerNameGuerra}>👔 {mgr.nome_guerra || mgr.name}</Text>
                          <Text style={styles.managerEmail}>{mgr.email || mgr.name}</Text>
                        </View>
                        <View style={styles.managerHeaderStats}>
                          <View style={styles.teamCountBadge}>
                            <Text style={styles.teamCountText}>{teamMembers.length} corretores</Text>
                          </View>
                          <Text style={styles.accordionToggleIcon}>{isExpanded ? '▲' : '▼'}</Text>
                        </View>
                      </TouchableOpacity>

                      {/* GAVETA DE CORRETORES EXPANSÍVEL */}
                      {isExpanded && (
                        <View style={styles.teamDrawer}>
                          <View style={styles.teamDrawerSummary}>
                            <Text style={styles.teamDrawerSummaryText}>
                              {activeCount} ativo(s) · {graceCount} em carência
                            </Text>
                          </View>
                          {teamMembers.length === 0 ? (
                            <Text style={styles.emptyDrawerText}>Nenhum corretor vinculado a este gerente.</Text>
                          ) : (
                            teamMembers.map((broker) => {
                              const isGrace = broker.status === 'grace_period';
                              return (
                                <TouchableOpacity 
                                  key={broker.id} 
                                  style={styles.brokerDrawerItem}
                                  onPress={() => setSelectedBrokerId(broker.id)}
                                >
                                  <View style={styles.brokerDrawerInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <Text style={styles.brokerDrawerName}>
                                        {broker.nome_guerra} <Text style={styles.brokerDrawerSubName}>({broker.name})</Text>
                                      </Text>
                                      {renderStageBadge(broker)}
                                    </View>
                                    <Text style={styles.brokerDrawerCreci}>
                                      CRECI: {broker.creci || '—'} · {broker.email}
                                    </Text>
                                  </View>
                                  <View style={styles.brokerDrawerAction}>
                                    <Text style={[styles.statusTag, isGrace ? styles.statusGrace : styles.statusActive]}>
                                      {isGrace ? 'Carência' : 'Ativo'}
                                    </Text>
                                    <Text style={styles.drawerCardBtn}>Ações →</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* CORRETORES DESVINCULADOS (SE HOUVER) */}
                {(brokersByManager['unassigned'] || []).length > 0 && (
                  <View style={[styles.managerAccordionCard, { borderColor: '#f59e0b' }]}>
                    <TouchableOpacity 
                      style={styles.managerAccordionHeader}
                      onPress={() => toggleManagerAccordion('unassigned')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.managerHeaderInfo}>
                        <Text style={[styles.managerNameGuerra, { color: '#b45309' }]}>⚠️ Corretores sem Gerente Vinculado</Text>
                        <Text style={styles.managerEmail}>Necessitam de transferência para uma gerência</Text>
                      </View>
                      <View style={styles.managerHeaderStats}>
                        <View style={[styles.teamCountBadge, { backgroundColor: '#fef3c7' }]}>
                          <Text style={[styles.teamCountText, { color: '#b45309' }]}>
                            {brokersByManager['unassigned'].length} corretor(es)
                          </Text>
                        </View>
                        <Text style={styles.accordionToggleIcon}>{expandedManagers['unassigned'] ? '▲' : '▼'}</Text>
                      </View>
                    </TouchableOpacity>

                    {expandedManagers['unassigned'] && (
                      <View style={styles.teamDrawer}>
                        {brokersByManager['unassigned'].map((broker) => (
                          <TouchableOpacity 
                            key={broker.id} 
                            style={styles.brokerDrawerItem}
                            onPress={() => setSelectedBrokerId(broker.id)}
                          >
                            <View style={styles.brokerDrawerInfo}>
                              <Text style={styles.brokerDrawerName}>{broker.nome_guerra} ({broker.name})</Text>
                              <Text style={styles.brokerDrawerCreci}>CRECI: {broker.creci || '—'}</Text>
                            </View>
                            <Text style={styles.drawerCardBtn}>Transferir →</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* MODO GERENTE: APROVAÇÕES PENDENTES, EQUIPE E FILA DE LEADS */}
        {!isDirectorOrRh && (
          <>
            {/* FILA DE APROVAÇÕES PENDENTES */}
            <Text style={styles.subHeader}>Aprovações Pendentes ({pending.length})</Text>
            <FlatList
              data={pending}
              keyExtractor={(item) => item.id}
              style={styles.list}
              scrollEnabled={false}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum corretor aguardando aprovação.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.brokerCard} activeOpacity={0.8} onPress={() => setSelectedBrokerId(item.id)}>
                  <View style={styles.brokerInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.brokerName}>{item.name}</Text>
                      {renderStageBadge(item)}
                    </View>
                    <Text style={styles.brokerSub}>Nome de Guerra: {item.nome_guerra}</Text>
                    <Text style={styles.brokerSub}>E-mail: {item.email}</Text>
                    <Text style={styles.brokerSub}>CRECI: {item.creci || 'Não informado / Em formação'}</Text>
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

            {/* FILA DA ROLETA / LEADS AO VIVO DA GERÊNCIA */}
            <Text style={styles.subHeader}>Fila da Roleta e Leads da Equipe ({leadsQueue.length})</Text>
            <FlatList
              data={leadsQueue}
              keyExtractor={(item) => item.brokerId}
              style={styles.list}
              scrollEnabled={false}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum corretor da sua equipe ativo na fila no momento.</Text>}
              renderItem={({ item }) => {
                const isHabilitado = item.isHabilitado.includes('HABILITADO');
                return (
                  <View style={[styles.queueCard, isHabilitado ? { borderColor: '#34c759', borderWidth: 1 } : null]}>
                    <View style={styles.queueInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {item.roletaPosition ? (
                          <View style={{ backgroundColor: '#1c1c1e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{item.roletaPosition}º Lugar</Text>
                          </View>
                        ) : null}
                        {item.roletaEntryType === 'pos_barra' && (
                          <View style={{ backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 11 }}>Pós-Barra</Text>
                          </View>
                        )}
                        <Text style={styles.queueName}>{item.nomeGuerra}</Text>
                      </View>
                      <Text style={styles.queueSub}>Presença: {item.statusPresenca}</Text>
                      <Text style={styles.queueSub}>Carência: {item.statusCarencia}</Text>
                      {item.minutesActive !== undefined && (
                        <Text style={[styles.queueSub, { color: item.minutesActive >= (item.minimumRequiredMinutes ?? 120) ? '#15803d' : '#4b5563', fontWeight: '600', marginTop: 2 }]}>
                          ⏱️ Validação Roleta: {item.minutesActive} / {item.minimumRequiredMinutes ?? 120} min
                        </Text>
                      )}
                    </View>
                    <View style={styles.queueAction}>
                      <Text style={[styles.statusBadge, { color: isHabilitado ? '#34c759' : '#ff3b30' }]}>
                        {item.isHabilitado}
                      </Text>
                      {isHabilitado && (
                        <TouchableOpacity style={[styles.copyNameBtn, { backgroundColor: primaryColor }]} onPress={() => handleCopyBrokerName(item.nomeGuerra)}>
                          <Text style={styles.copyNameBtnText}>Copiar Nome</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {/* ELEGIBILIDADE DE FIM DE SEMANA DA EQUIPE */}
            <Text style={styles.subHeader}>Elegibilidade de Fim de Semana (Equipe)</Text>
            <View style={styles.kpiContainer}>
              <View style={[styles.kpiCard, { borderColor: '#15803d' }]}>
                <Text style={[styles.kpiValue, { color: '#15803d' }]}>{teamEligibility?.saturdayEligibleCount ?? 0}</Text>
                <Text style={styles.kpiLabel}>Elegíveis Sábado</Text>
                <Text style={styles.kpiSub}>Meta de 5 roletas batida</Text>
              </View>
              <View style={[styles.kpiCard, { borderColor: '#15803d' }]}>
                <Text style={[styles.kpiValue, { color: '#15803d' }]}>{teamEligibility?.sundayEligibleCount ?? 0}</Text>
                <Text style={styles.kpiLabel}>Elegíveis Domingo</Text>
                <Text style={styles.kpiSub}>Meta de 6 roletas batida</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{teamEligibility?.inProgressCount ?? 0}</Text>
                <Text style={styles.kpiLabel}>Em Progresso</Text>
                <Text style={styles.kpiSub}>Acumulando roletas</Text>
              </View>
            </View>

            {/* LISTA DETALHADA DE ELEGIBILIDADE POR CORRETOR DA EQUIPE */}
            {(teamEligibility?.brokers || []).length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
                  Detalhes por Corretor:
                </Text>
                {(teamEligibility?.brokers || []).map((bInfo: any) => (
                  <View key={bInfo.brokerId} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: '#111827' }}>{bInfo.brokerNomeGuerra}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: bInfo.saturdayEligible && bInfo.sundayEligible ? '#15803d' : '#b45309' }}>
                        {bInfo.saturdayEligible && bInfo.sundayEligible ? '🟢 Totalmente Elegível' : bInfo.saturdayEligible ? '🟡 Elegível Sábado' : '⚪ Não Elegível'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Roletas válidas na semana: <Text style={{ fontWeight: '700', color: '#111827' }}>{bInfo.accumulatedWeekPeriods}</Text> (Sáb: {bInfo.saturdayRequired} / Dom: {bInfo.sundayRequired})
                    </Text>
                    {bInfo.boothBreakdown && bInfo.boothBreakdown.length > 0 && (
                      <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
                        {bInfo.boothBreakdown.map((b: any) => (
                          <Text key={b.boothId} style={{ fontSize: 12, color: '#4b5563' }}>
                            • {b.boothName}: <Text style={{ fontWeight: '700' }}>{b.validRoletasThisWeek}</Text> roletas {b.saturdayEligible ? '🟢 Elegível' : `(faltam ${b.missingSaturday} p/ Sáb)`}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* MINHA EQUIPE */}
            <Text style={styles.subHeader}>Minha Equipe ({team.length})</Text>
            <FlatList
              data={team}
              keyExtractor={(item) => item.id}
              style={styles.list}
              scrollEnabled={false}
              ListEmptyComponent={<Text style={styles.emptyText}>Sua equipe de vendas está vazia no momento.</Text>}
              renderItem={({ item }) => {
                const isGrace = item.status === 'grace_period';
                return (
                  <TouchableOpacity style={styles.teamCard} activeOpacity={0.8} onPress={() => setSelectedBrokerId(item.id)}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={styles.teamName}>{item.nome_guerra} ({item.name})</Text>
                        {renderStageBadge(item)}
                      </View>
                      {isGrace && item.carencia_ends_at ? (
                        <Text style={styles.carenciaLabel}>Carência ativa até: {new Date(item.carencia_ends_at).toLocaleDateString('pt-BR')}</Text>
                      ) : (
                        <Text style={styles.activeLabel}>🟢 Liberado no CVCRM (Recebendo Leads)</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1c1c1e',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  backText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 3,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
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
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    marginBottom: 12,
  },
  sectionDescHeader: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  roleButton: { 
    borderWidth: 1, 
    borderColor: '#d1d5db', 
    borderRadius: 8, 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    marginRight: 8 
  },
  roleButtonActive: { 
    backgroundColor: '#1c1c1e', 
    borderColor: '#1c1c1e' 
  },
  roleButtonText: { 
    color: '#1f2937', 
    fontWeight: '700' 
  },
  roleButtonTextActive: { 
    color: '#FFFFFF', 
    fontWeight: '800' 
  },
  managerPicker: { 
    marginBottom: 12 
  },
  managerButton: { 
    backgroundColor: '#eef2ff', 
    borderWidth: 1, 
    borderColor: '#c7d2fe', 
    borderRadius: 8, 
    padding: 8, 
    paddingHorizontal: 12,
    marginRight: 8 
  },
  managerButtonActive: { 
    backgroundColor: '#1e3a8a', 
    borderColor: '#1e3a8a' 
  },
  managerButtonText: { 
    color: '#1e3a8a', 
    fontWeight: '700',
    fontSize: 13,
  },
  managerButtonTextActive: { 
    color: '#FFFFFF', 
    fontWeight: '800',
    fontSize: 13,
  },
  generateButton: {
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
    marginTop: 8,
  },
  linkLabel: {
    flex: 1,
    fontSize: 13,
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
  directorSection: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  globalSearchInput: {
    height: 46,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
  },
  searchResultsBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  searchResultsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  searchResultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  brokerMainInfo: {
    flex: 1,
  },
  brokerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  brokerRealName: {
    fontWeight: '400',
    color: '#4b5563',
  },
  brokerMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: '#111827',
  },
  brokerRightBadge: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusActive: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  statusGrace: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  actionPromptText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '700',
    marginTop: 4,
  },
  managerListSection: {
    marginTop: 6,
  },
  managerAccordionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  managerAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  managerHeaderInfo: {
    flex: 1,
  },
  managerNameGuerra: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  managerEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  managerHeaderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCountBadge: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  teamCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  accordionToggleIcon: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '800',
  },
  teamDrawer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fafafc',
    padding: 12,
  },
  teamDrawerSummary: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  teamDrawerSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptyDrawerText: {
    fontSize: 13,
    color: '#9ca3af',
    padding: 12,
    textAlign: 'center',
  },
  brokerDrawerItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brokerDrawerInfo: {
    flex: 1,
  },
  brokerDrawerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  brokerDrawerSubName: {
    fontWeight: '400',
    color: '#6b7280',
  },
  brokerDrawerCreci: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  brokerDrawerAction: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  drawerCardBtn: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
    marginTop: 4,
  },
  subHeader: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 8,
    marginTop: 12,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  list: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  brokerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  brokerInfo: {
    marginBottom: 12,
  },
  brokerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  brokerSub: {
    fontSize: 13,
    color: '#3a3a3c',
    marginBottom: 2,
  },
  actionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
    paddingTop: 10,
  },
  approveBtn: {
    flex: 1,
    minWidth: 70,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  approveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  teamCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  teamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  carenciaLabel: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
  },
  activeLabel: {
    fontSize: 12,
    color: '#34c759',
    fontWeight: '600',
  },
  queueCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  queueInfo: {
    marginBottom: 8,
  },
  queueName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  queueSub: {
    fontSize: 12,
    color: '#3a3a3c',
    marginBottom: 2,
  },
  queueAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  copyNameBtn: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyNameBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    marginVertical: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  badgeTreinamento: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTextTreinamento: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeEstagiario: {
    backgroundColor: '#fefce8',
    borderColor: '#fde047',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTextEstagiario: {
    color: '#a16207',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeCreci: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTextCreci: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  stageSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  stageSelectBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  stageSelectText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  stageSelectTextActive: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
});