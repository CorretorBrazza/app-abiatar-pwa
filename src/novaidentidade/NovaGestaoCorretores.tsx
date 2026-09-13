import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';

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

interface Candidate {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci?: string;
  broker_stage?: 'treinamento' | 'estagiario' | 'corretor_creci';
  manager_id?: string | null;
  manager_nome_guerra?: string | null;
  created_at?: string;
}

interface ManagerItem {
  id: string;
  nome_guerra: string;
  name: string;
  email?: string;
}

interface BrokerProfile {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci: string | null;
  broker_stage?: 'treinamento' | 'estagiario' | 'corretor_creci';
  status: string;
  manager_id: string | null;
  manager_nome_guerra: string | null;
  leads_paused: boolean;
  carencia_ends_at: string | null;
  stage_expires_at?: string | null;
  days_until_stage_expiry?: number | null;
  is_stage_expired?: boolean;
  last_checkin_at?: string | null;
  days_since_last_checkin?: number | null;
  is_inactive_90d?: boolean;
  suspension_reason?: string | null;
  is_suspended?: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  treinamento: '🔵 Treinamento',
  estagiario: '🟡 Estagiário',
  corretor_creci: '🟢 Corretor CRECI',
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '—';

const fmtDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : '—';

function StageBadge({ broker }: { broker: BrokerItem | Candidate }) {
  const isSuspended =
    'is_suspended' in broker && (broker.is_suspended || broker.is_stage_expired || broker.is_inactive_90d);
  if (isSuspended) {
    const tone = statusTone.danger;
    return (
      <View style={styles.stageBadge}>
        <Text style={[styles.stageBadgeText, { color: tone.fg }]}>
          🔴 SUSPENSO ({('suspension_reason' in broker && broker.suspension_reason) || 'Vencido'})
        </Text>
      </View>
    );
  }
  const stage = broker.broker_stage || 'corretor_creci';
  const days = 'days_until_stage_expiry' in broker ? broker.days_until_stage_expiry : null;
  const tone = stage === 'treinamento' ? statusTone.info : stage === 'estagiario' ? statusTone.attention : statusTone.positive;
  const suffix = stage === 'treinamento' ? '(90d)' : stage === 'estagiario' ? '(6m)' : '';
  const daysLabel = days !== null && days !== undefined ? `${days}d` : suffix;
  return (
    <View style={[styles.stageBadge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.stageBadgeText, { color: tone.fg }]}>
        {STAGE_LABEL[stage]} {stage !== 'corretor_creci' ? `(${daysLabel})` : ''}
      </Text>
    </View>
  );
}

export default function NovaGestaoCorretores({
  hideTitle = false,
  isMobile = false,
  sidebarOffset = 0,
  topOffset = 0,
}: {
  hideTitle?: boolean;
  isMobile?: boolean;
  sidebarOffset?: number;
  topOffset?: number;
}) {
  const [allBrokers, setAllBrokers] = useState<BrokerItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [pending, setPending] = useState<Candidate[]>([]);
  const [boothsCount, setBoothsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteRole, setInviteRole] = useState<'gerencia_level_2' | 'corretor_level_3'>('corretor_level_3');
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const [globalSearch, setGlobalSearch] = useState('');
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editName, setEditName] = useState('');
  const [editNomeGuerra, setEditNomeGuerra] = useState('');
  const [editCreci, setEditCreci] = useState('');
  const [editStage, setEditStage] = useState<'treinamento' | 'estagiario' | 'corretor_creci'>('treinamento');
  const [editManagerId, setEditManagerId] = useState('');

  const [correctionCandidate, setCorrectionCandidate] = useState<Candidate | null>(null);
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);

  const [fichaBrokerId, setFichaBrokerId] = useState<string | null>(null);

  const CORRECTION_TEMPLATES: Array<{ label: string; text: string }> = [
    { label: '📷 Documento ilegível', text: 'Os documentos anexados estão ilegíveis. Por favor, reenvie fotos nítidas, sem cortes e sem reflexo.' },
    { label: '📄 Documento incompleto', text: 'Algum documento foi enviado incompleto ou incorreto. Confira e reenvie o documento faltante ou válido.' },
    { label: '🏠 Residência desatualizada', text: 'O comprovante de residência está desatualizado. Envie uma conta de luz, água ou contrato de aluguel com emissão nos últimos 90 dias.' },
    { label: '🪪 CRECI divergente', text: 'O número do CRECI não pôde ser confirmado ou está divergente. Confira o documento e reenvie.' },
    { label: '✏️ Dados divergentes', text: 'Os dados informados no cadastro não conferem com os documentos anexados. Revise nome, CPF e endereço.' },
  ];

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [managersRes, brokersRes, boothsRes, pendingRes] = await Promise.all([
        api.get('/users/managers/active'),
        api.get('/users/active-brokers', { params: { pageSize: 500 } }),
        api.get('/booths'),
        api.get('/users/pending-hr-review').catch(() => ({ data: [] })),
      ]);
      const managersData = Array.isArray(managersRes.data) ? managersRes.data : [];
      const brokersData = Array.isArray(brokersRes.data) ? brokersRes.data : brokersRes.data?.data || [];
      const boothsData = Array.isArray(boothsRes.data) ? boothsRes.data : [];
      const pendingData = Array.isArray(pendingRes.data) ? pendingRes.data : [];
      setManagers(managersData);
      setAllBrokers(brokersData);
      setBoothsCount(boothsData.length);
      setPending(pendingData);
      if (!selectedManagerId && managersData[0]) setSelectedManagerId(managersData[0].id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar a estrutura de corretores.');
    } finally {
      setLoading(false);
    }
  }, [selectedManagerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleRealtime = () => { void loadData(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('abiatar:realtime', handleRealtime);
      window.addEventListener('abiatar:booth_update', handleRealtime);
    }
    const intervalId = setInterval(() => { void loadData(); }, 15000);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('abiatar:realtime', handleRealtime);
        window.removeEventListener('abiatar:booth_update', handleRealtime);
      }
      clearInterval(intervalId);
    };
  }, [loadData]);

  const brokersByManager = useMemo(() => {
    const map: Record<string, BrokerItem[]> = {};
    managers.forEach((m) => { map[m.id] = []; });
    map['unassigned'] = [];
    allBrokers.forEach((broker) => {
      if (broker.manager_id && map[broker.manager_id]) map[broker.manager_id].push(broker);
      else map['unassigned'].push(broker);
    });
    return map;
  }, [allBrokers, managers]);

  const searchFilteredBrokers = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return allBrokers.filter((b) =>
      b.name.toLowerCase().includes(q) ||
      b.nome_guerra.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      (b.creci && b.creci.toLowerCase().includes(q)),
    );
  }, [allBrokers, globalSearch]);

  const totalActive = useMemo(() => allBrokers.filter((b) => b.status === 'active').length, [allBrokers]);
  const totalGrace = useMemo(() => allBrokers.filter((b) => b.status === 'grace_period').length, [allBrokers]);

  const toggleManagerAccordion = (mId: string) =>
    setExpandedManagers((prev) => ({ ...prev, [mId]: !prev[mId] }));

  const handleApprove = async (candidate: Candidate, carenciaDays = 0) => {
    try {
      setProcessingId(candidate.id);
      const res = await api.patch(`/users/${candidate.id}/hr-approve`, { carenciaDays });
      alert(res.data?.message || `Corretor ${candidate.nome_guerra} aprovado e ativado para check-in!`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao aprovar cadastro.');
    } finally {
      setProcessingId(null);
    }
  };

  const openEditCandidate = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setEditName(candidate.name || '');
    setEditNomeGuerra(candidate.nome_guerra || '');
    setEditCreci(candidate.creci || '');
    setEditStage(candidate.broker_stage || 'treinamento');
    setEditManagerId(candidate.manager_id || managers[0]?.id || '');
  };

  const saveEditCandidate = async () => {
    if (!editingCandidate) return;
    if (!editNomeGuerra.trim()) {
      alert('Nome de Guerra é obrigatório.');
      return;
    }
    try {
      setProcessingId(editingCandidate.id);
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
      setProcessingId(null);
    }
  };

  const hardDeleteCandidate = async (candidate: Candidate) => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Excluir DEFINITIVAMENTE o cadastro de ${candidate.nome_guerra}?\n\nEsta ação apagará o cadastro e LIBERARÁ o Nome de Guerra e o E-mail imediatamente para novo uso.`);
    if (!confirmed) return;
    try {
      setProcessingId(candidate.id);
      const res = await api.delete(`/users/${candidate.id}/hard-delete`);
      alert(res.data?.message || 'Cadastro excluído com sucesso.');
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao excluir cadastro.');
    } finally {
      setProcessingId(null);
    }
  };

  const notifyCorrection = async () => {
    if (!correctionCandidate) return;
    if (correctionMessage.trim().length < 3) {
      alert('Escreva o motivo da correção (mínimo 3 caracteres).');
      return;
    }
    try {
      setCorrectionLoading(true);
      const res = await api.post(`/users/${correctionCandidate.id}/hr-notify-correction`, {
        message: correctionMessage.trim(),
      });
      alert(res.data?.message || `Pedido de correção enviado para ${correctionCandidate.nome_guerra}.`);
      setCorrectionCandidate(null);
      setCorrectionMessage('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao enviar solicitação de correção.');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const generateInvite = async () => {
    try {
      setGeneratingInvite(true);
      if (inviteRole === 'corretor_level_3' && !selectedManagerId) {
        alert('Selecione um Gerente responsável antes de convidar um Corretor.');
        return;
      }
      const response = await api.post('/users/onboarding-link', {
        invitedRole: inviteRole,
        managerId: inviteRole === 'corretor_level_3' ? selectedManagerId : undefined,
      });
      const token = response.data.token;
      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'https://abiatar.bitimob.com.br';
      setInviteLink(token ? `${origin}/cadastro/${token}` : response.data.onboarding_url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao gerar link de convite.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
      alert('Link de convite copiado para a área de transferência!');
    } else {
      alert(`Copie o link: ${inviteLink}`);
    }
  };

  const renderKpis = () => (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiValue}>{allBrokers.length}</Text>
        <Text style={styles.kpiLabel}>Total Corretores</Text>
        <Text style={styles.kpiSub}>{totalActive} ativos · {totalGrace} em carência</Text>
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
  );

  const renderApprovalQueue = () => (
    <View style={[styles.card, { borderColor: colors.coral300 }]}>
      <View style={styles.rowBetween}>
        <Text style={fonts.panelTitle}>Aprovação de novos cadastros ({pending.length})</Text>
        {pending.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: statusTone.attention.bg }]}>
            <Text style={[styles.countPillText, { color: statusTone.attention.fg }]}>Aguardando Diretoria</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardSub}>
        Aprovação centralizada na Diretoria. Ao aprovar, o corretor é ativado imediatamente e liberado para check-in.
      </Text>
      {pending.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Nenhum corretor aguardando aprovação no momento.</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 6 }}>
          {pending.map((candidate) => (
            <View key={candidate.id} style={stylesheetCandidate}>
              <View style={{ flex: 1, minWidth: 220, gap: 3 }}>
                <View style={styles.brokerNameRow}>
                  <Text style={styles.brokerName}>{candidate.nome_guerra}</Text>
                  <Text style={styles.brokerRealName}>({candidate.name})</Text>
                  <StageBadge broker={candidate} />
                </View>
                <Text style={styles.brokerMeta}>
                  {candidate.email} · CRECI: {candidate.creci || '—'}
                </Text>
                <Text style={styles.brokerMeta}>
                  Equipe vinculada: <Text style={styles.boldText}>Gerente {candidate.manager_nome_guerra || 'Sem gerente'}</Text>
                </Text>
                <Text style={styles.brokerMeta}>Enviado em: {fmtDateTime(candidate.created_at)}</Text>
              </View>
              <View style={[styles.actionRow, isMobile && styles.actionRowMobile]}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => void handleApprove(candidate, 0)}
                  disabled={processingId === candidate.id}
                >
                  {processingId === candidate.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <CheckCircle2 size={13} color="#fff" />
                  )}
                  <Text style={styles.primaryBtnText}>Aprovar e Ativar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditCandidate(candidate)}
                  disabled={processingId === candidate.id}
                >
                  <Pencil size={13} color={colors.coral600} />
                  <Text style={styles.actionBtnText}>Ajustar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.amber700 }]}
                  onPress={() => {
                    setCorrectionCandidate(candidate);
                    setCorrectionMessage('');
                  }}
                  disabled={processingId === candidate.id}
                >
                  <Mail size={13} color={colors.amber700} />
                  <Text style={[styles.actionBtnText, { color: colors.amber700 }]}>Solicitar Correção</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.red700 }]}
                  onPress={() => void hardDeleteCandidate(candidate)}
                  disabled={processingId === candidate.id}
                >
                  {processingId === candidate.id ? (
                    <ActivityIndicator size="small" color={colors.red700} />
                  ) : (
                    <Trash2 size={13} color={colors.red700} />
                  )}
                  <Text style={[styles.actionBtnText, { color: colors.red700 }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderInvites = () => (
    <View style={styles.card}>
      <Text style={fonts.panelTitle}>Gerar Convite de Acesso</Text>
      <Text style={styles.cardSub}>Links de convite únicos vinculados automaticamente à hierarquia.</Text>

      <Text style={styles.fieldLabel}>Tipo de convite</Text>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, inviteRole === 'gerencia_level_2' && styles.tabActive]}
          onPress={() => setInviteRole('gerencia_level_2')}
        >
          <Text style={[styles.tabText, inviteRole === 'gerencia_level_2' && styles.tabTextActive]}>Gerente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, inviteRole === 'corretor_level_3' && styles.tabActive]}
          onPress={() => setInviteRole('corretor_level_3')}
        >
          <Text style={[styles.tabText, inviteRole === 'corretor_level_3' && styles.tabTextActive]}>Corretor</Text>
        </TouchableOpacity>
      </View>

      {inviteRole === 'corretor_level_3' && (
        <>
          <Text style={styles.fieldLabel}>Vincular ao Gerente responsável</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {managers.map((manager) => {
              const active = selectedManagerId === manager.id;
              return (
                <TouchableOpacity
                  key={manager.id}
                  style={[styles.boothBtn, active && styles.boothBtnActive]}
                  onPress={() => setSelectedManagerId(manager.id)}
                >
                  <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{manager.nome_guerra || manager.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!managers.length && <Text style={styles.emptyText}>Nenhum gerente ativo disponível.</Text>}
        </>
      )}

      {inviteLink ? (
        <View style={[styles.inviteBanner, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Text style={[styles.inviteText, { flex: 1 }]} numberOfLines={2}>{inviteLink}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => void copyInvite()}>
            <Copy size={13} color={colors.blue700} />
            <Text style={styles.copyBtnText}>Copiar Link</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void generateInvite()} disabled={generatingInvite}>
          {generatingInvite ? <ActivityIndicator size="small" color="#fff" /> : <Link2 size={14} color="#fff" />}
          <Text style={styles.primaryBtnText}>{generatingInvite ? 'Gerando...' : 'Gerar Link de Cadastro'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHierarchy = () => (
    <View style={styles.card}>
      <Text style={fonts.panelTitle}>Busca Global de Corretor</Text>
      <Text style={styles.cardSub}>Digite nome, nome de guerra ou CRECI para localizar qualquer corretor.</Text>

      <View style={[styles.searchBar]}>
        <Search size={15} color={colors.slate500} />
        <TextInput
          style={styles.searchInput}
          value={globalSearch}
          onChangeText={setGlobalSearch}
          placeholder="Buscar corretor..."
          placeholderTextColor={colors.slate400}
        />
      </View>

      {globalSearch.trim().length > 0 ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={styles.resultCount}>
            {searchFilteredBrokers.length} corretor(es) encontrado(s):
          </Text>
          {searchFilteredBrokers.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum corretor encontrado com este termo.</Text>
          ) : (
            searchFilteredBrokers.map((broker) => {
              const mgr = managers.find((m) => m.id === broker.manager_id);
              const isGrace = broker.status === 'grace_period';
              return (
                <TouchableOpacity key={broker.id} style={styles.userCard} onPress={() => setFichaBrokerId(broker.id)}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{(broker.nome_guerra || '?').charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={styles.brokerNameRow}>
                      <Text style={styles.brokerName}>{broker.nome_guerra}</Text>
                      <Text style={styles.brokerRealName}>({broker.name})</Text>
                    </View>
                    <Text style={styles.brokerMeta}>
                      Gerente: <Text style={styles.boldText}>{mgr?.nome_guerra || mgr?.name || 'Não vinculado'}</Text> · CRECI: {broker.creci || '—'}
                    </Text>
                    <View style={styles.brokerNameRow}>
                      <StageBadge broker={broker} />
                    </View>
                  </View>
                  <View style={styles.userRight}>
                    <View style={[styles.roleBadge, { backgroundColor: isGrace ? statusTone.attention.bg : statusTone.positive.bg }]}>
                      <Text style={[styles.roleBadgeText, { color: isGrace ? statusTone.attention.fg : statusTone.positive.fg }]}>
                        {isGrace ? 'Carência' : 'Ativo'}
                      </Text>
                    </View>
                    <Text style={styles.actionPrompt}>Abrir Ficha →</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text style={styles.resultCount}>Equipes por Gerência ({managers.length})</Text>
          <Text style={styles.cardSub}>Toque na equipe para expandir e gerenciar os corretores vinculados.</Text>

          {managers.map((mgr) => {
            const teamMembers = brokersByManager[mgr.id] || [];
            const activeCount = teamMembers.filter((b) => b.status === 'active').length;
            const graceCount = teamMembers.filter((b) => b.status === 'grace_period').length;
            const isExpanded = Boolean(expandedManagers[mgr.id]);
            return (
              <View key={mgr.id} style={styles.accordion}>
                <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleManagerAccordion(mgr.id)} activeOpacity={0.7}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.managerName}>{'👔'} {mgr.nome_guerra || mgr.name}</Text>
                    <Text style={styles.managerEmail}>{mgr.email || mgr.name}</Text>
                  </View>
                  <View style={styles.managerHeaderStats}>
                    <View style={styles.teamCountBadge}>
                      <Text style={styles.teamCountText}>{teamMembers.length} corretores</Text>
                    </View>
                    <Text style={styles.toggleIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.teamDrawer}>
                    <Text style={styles.teamDrawerSummary}>
                      {activeCount} ativo(s) · {graceCount} em carência
                    </Text>
                    {teamMembers.length === 0 ? (
                      <Text style={styles.emptyText}>Nenhum corretor vinculado a este gerente.</Text>
                    ) : (
                      teamMembers.map((broker) => {
                        const isGrace = broker.status === 'grace_period';
                        return (
                          <TouchableOpacity
                            key={broker.id}
                            style={styles.drawerItem}
                            onPress={() => setFichaBrokerId(broker.id)}
                          >
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <View style={styles.brokerNameRow}>
                                <Text style={styles.drawerName}>{broker.nome_guerra}</Text>
                                <Text style={styles.brokerRealName}>({broker.name})</Text>
                              </View>
                              <Text style={styles.brokerMeta}>CRECI: {broker.creci || '—'} · {broker.email}</Text>
                              <View style={styles.brokerNameRow}>
                                <StageBadge broker={broker} />
                              </View>
                            </View>
                            <View style={styles.userRight}>
                              <View style={[styles.roleBadge, { backgroundColor: isGrace ? statusTone.attention.bg : statusTone.positive.bg }]}>
                                <Text style={[styles.roleBadgeText, { color: isGrace ? statusTone.attention.fg : statusTone.positive.fg }]}>
                                  {isGrace ? 'Carência' : 'Ativo'}
                                </Text>
                              </View>
                              <Text style={styles.actionPrompt}>Ações →</Text>
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

          {(brokersByManager['unassigned'] || []).length > 0 && (
            <View style={[styles.accordion, { borderColor: colors.amber700, borderWidth: 1 }]}>
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleManagerAccordion('unassigned')} activeOpacity={0.7}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.managerName, { color: colors.amber800 }]}>⚠️ Corretores sem Gerente Vinculado</Text>
                  <Text style={styles.managerEmail}>Necessitam de transferência para uma gerência</Text>
                </View>
                <View style={styles.managerHeaderStats}>
                  <View style={[styles.teamCountBadge, { backgroundColor: colors.amber100 }]}>
                    <Text style={[styles.teamCountText, { color: colors.amber800 }]}>{brokersByManager['unassigned'].length} corretor(es)</Text>
                  </View>
                  <Text style={styles.toggleIcon}>{expandedManagers['unassigned'] ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>
              {expandedManagers['unassigned'] && (
                <View style={styles.teamDrawer}>
                  {brokersByManager['unassigned'].map((broker) => (
                    <TouchableOpacity key={broker.id} style={styles.drawerItem} onPress={() => setFichaBrokerId(broker.id)}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.drawerName}>{broker.nome_guerra} ({broker.name})</Text>
                        <Text style={styles.brokerMeta}>CRECI: {broker.creci || '—'}</Text>
                      </View>
                      <Text style={styles.actionPrompt}>Transferir →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {!hideTitle && (
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroBadge}>
            <ShieldCheck size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>Diretoria · Gestão Executiva de Corretores</Text>
          </View>
          <Text style={styles.heroTitle}>Estrutura comercial.</Text>
          <Text style={styles.heroSubtitle}>Hierarquia por gerência, aprovação de cadastros, convites e ficha individual do corretor.</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.coral600} />
        </View>
      ) : (
        <>
          {renderKpis()}
          {renderApprovalQueue()}
          {renderInvites()}
          {renderHierarchy()}
        </>
      )}

      {editingCandidate && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingCandidate(null)}>
          <View style={styles.modalWrap}>
            <View style={styles.modalBox}>
              <View style={styles.rowBetween}>
                <Text style={fonts.panelTitle}>Ajustar cadastro na triagem</Text>
                <TouchableOpacity onPress={() => setEditingCandidate(null)}>
                  <X size={16} color={colors.slate500} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>Corrija os dados antes de encaminhar para a Gerência.</Text>

              <Text style={styles.fieldLabel}>Nome completo</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nome completo" placeholderTextColor={colors.slate400} />

              <Text style={styles.fieldLabel}>Nome de Guerra *</Text>
              <TextInput
                style={styles.input}
                value={editNomeGuerra}
                onChangeText={(v) => setEditNomeGuerra(v.toLocaleUpperCase('pt-BR'))}
                placeholder="NOME DE GUERRA"
                placeholderTextColor={colors.slate400}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Estágio profissional</Text>
              <View style={styles.boothList}>
                {(['treinamento', 'estagiario', 'corretor_creci'] as const).map((s) => {
                  const active = editStage === s;
                  return (
                    <TouchableOpacity key={s} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => setEditStage(s)}>
                      <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{STAGE_LABEL[s]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Número do CRECI</Text>
              <TextInput style={styles.input} value={editCreci} onChangeText={(v) => setEditCreci(v.toUpperCase())} placeholder="Ex: 123456-F" placeholderTextColor={colors.slate400} autoCapitalize="characters" />

              <Text style={styles.fieldLabel}>Gerente responsável</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {managers.map((m) => {
                  const active = editManagerId === m.id;
                  return (
                    <TouchableOpacity key={m.id} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => setEditManagerId(m.id)}>
                      <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>Gerente {m.nome_guerra || m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.slate400 }]} onPress={() => setEditingCandidate(null)} disabled={!!processingId}>
                  <Text style={[styles.actionBtnText, { color: colors.slate600 }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void saveEditCandidate()} disabled={!!processingId}>
                  {processingId ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Salvar Ajustes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {correctionCandidate && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setCorrectionCandidate(null)}>
          <View style={styles.modalWrap}>
            <View style={styles.modalBox}>
              <View style={styles.rowBetween}>
                <Text style={fonts.panelTitle}>Solicitar correção de documentos</Text>
                <TouchableOpacity onPress={() => setCorrectionCandidate(null)}>
                  <X size={16} color={colors.slate500} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>
                Um e-mail será enviado para <Text style={styles.boldText}>{correctionCandidate.nome_guerra}</Text> ({correctionCandidate.email}) solicitando o reenvio da documentação.
              </Text>

              <Text style={styles.fieldLabel}>Modelos prontos (toque para usar)</Text>
              <View style={{ gap: 6 }}>
                {CORRECTION_TEMPLATES.map((tpl) => (
                  <TouchableOpacity key={tpl.label} style={styles.templateBtn} onPress={() => setCorrectionMessage(tpl.text)}>
                    <Text style={styles.templateLabel}>{tpl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Motivo / texto do e-mail *</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={correctionMessage}
                onChangeText={setCorrectionMessage}
                placeholder="Descreva o que precisa ser corrigido na documentação..."
                placeholderTextColor={colors.slate400}
                multiline
              />

              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  O e-mail informará ao corretor: "Não responda este e-mail. Envie a documentação que está faltando para gestaoautonomos@abiatar.com".
                </Text>
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.slate400 }]} onPress={() => setCorrectionCandidate(null)} disabled={correctionLoading}>
                  <Text style={[styles.actionBtnText, { color: colors.slate600 }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void notifyCorrection()} disabled={correctionLoading}>
                  {correctionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Mail size={14} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Enviar E-mail</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <FichaCorretorModal
        brokerId={fichaBrokerId}
        managers={managers}
        isMobile={isMobile}
        sidebarOffset={sidebarOffset}
        topOffset={topOffset}
        mode="diretoria"
        onClose={() => setFichaBrokerId(null)}
        onSaved={() => void loadData()}
      />
    </View>
  );
}

const stylesheetCandidate = {
  backgroundColor: colors.coral050,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.coral300,
  padding: 14,
  gap: 10,
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'flex-start' as const,
  flexWrap: 'wrap' as const,
};

export function FichaCorretorModal({
  brokerId,
  managers,
  isMobile = false,
  sidebarOffset = 0,
  topOffset = 0,
  mode = 'diretoria',
  onClose,
  onSaved,
}: {
  brokerId: string | null;
  managers: ManagerItem[];
  isMobile?: boolean;
  sidebarOffset?: number;
  topOffset?: number;
  mode?: 'diretoria' | 'rh';
  onClose: () => void;
  onSaved: () => void;
}) {
  const isRh = mode === 'rh';
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [creci, setCreci] = useState('');
  const [selectedStage, setSelectedStage] = useState<'treinamento' | 'estagiario' | 'corretor_creci'>('corretor_creci');
  const [reason, setReason] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  const loadProfile = useCallback(async () => {
    if (!brokerId) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/${brokerId}/management-profile`);
      setProfile(response.data);
      setNomeGuerra(response.data.nome_guerra || '');
      setCreci(response.data.creci || '');
      setSelectedStage(response.data.broker_stage || 'corretor_creci');
      setSelectedManagerId(response.data.manager_id || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível carregar o perfil do Corretor.');
    } finally {
      setLoading(false);
    }
  }, [brokerId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateProfile = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      setError('');
      await api.patch(`/users/${profile.id}/management-profile`, { nomeGuerra, creci });
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível atualizar o Corretor.');
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (newStage: 'treinamento' | 'estagiario' | 'corretor_creci') => {
    if (!profile) return;
    try {
      setSaving(true);
      setError('');
      await api.patch(`/users/${profile.id}/stage`, { brokerStage: newStage, creci });
      setSelectedStage(newStage);
      await loadProfile();
      onSaved();
      alert(`Estágio do corretor atualizado para ${STAGE_LABEL[newStage].replace(/^\S+\s/, '')} com sucesso!`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível alterar o estágio do Corretor.');
    } finally {
      setSaving(false);
    }
  };

  const extendStageDays = async (days: number) => {
    if (!profile) return;
    try {
      setSaving(true);
      setError('');
      await api.patch(`/users/${profile.id}/stage`, { extendDays: days, reason: `Renovação de +${days} dias pela Diretoria` });
      await loadProfile();
      onSaved();
      alert(`Prazo de vigência do estágio renovado por mais ${days} dias! O corretor está ativo.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível renovar o prazo de estágio.');
    } finally {
      setSaving(false);
    }
  };

  const setPause = async (paused: boolean) => {
    if (!profile || reason.trim().length < 3) {
      setError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await api.patch(`/users/${profile.id}/${paused ? 'leads-pause' : 'leads-resume'}`, { reason });
      setReason('');
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível alterar a situação de leads.');
    } finally {
      setSaving(false);
    }
  };

  const removeBroker = async () => {
    if (!profile || reason.trim().length < 3) {
      setError('Informe o motivo da exclusão lógica.');
      return;
    }
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Excluir ${profile.nome_guerra} da operação?\nO histórico será preservado, mas o acesso será bloqueado.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      setError('');
      await api.delete(`/users/${profile.id}`, { data: { reason } });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível remover o Corretor.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      setError('');
      const response = await api.post(`/auth/reset-password/${profile.id}`, { reason: 'Redefinição solicitada pela gestão' });
      setTempPassword(response.data.temporaryPassword || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível redefinir a senha.');
    } finally {
      setSaving(false);
    }
  };

  const transferBroker = async () => {
    if (!profile || !selectedManagerId) {
      setError('Selecione um Gerente ativo.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await api.patch(`/users/${profile.id}/transfer`, { managerId: selectedManagerId, reason: reason || 'Transferência administrativa' });
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível transferir o Corretor.');
    } finally {
      setSaving(false);
    }
  };

  const isDesktopSheet = Platform.OS === 'web' && !isMobile;

  const renderBody = () => (
    <>
      <View style={[styles.fichaHeader, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
        <View style={styles.fichaHeaderRow}>
          <TouchableOpacity style={styles.fichaBackBtn} onPress={onClose}>
            <Text style={styles.fichaBackText}>← Voltar</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.fichaHeaderTitle}>{isRh ? 'Gestão de Estágio do Corretor' : 'Ficha do Corretor'}</Text>
            <Text style={styles.fichaHeaderSubtitle}>
              {isRh ? 'Evolução de carreira, vigência de estágio e dados cadastrais' : 'Gestão individual, operação e vínculo hierárquico'}
            </Text>
          </View>
        </View>
        {profile && (
          <View style={styles.fichaHeaderMeta}>
            <Text style={styles.fichaHeaderName}>{profile.nome_guerra}</Text>
            <Text style={styles.fichaHeaderSubtitle}>{profile.name} · {profile.email}</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.fichaContent}>
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        {loading || !profile ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.coral600} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.fichaName}>{profile.name}</Text>
              <Text style={styles.fichaLine}>Nome de guerra: {profile.nome_guerra}</Text>
              <Text style={styles.fichaLine}>E-mail: {profile.email}</Text>
              <Text style={styles.fichaLine}>CRECI: {profile.creci || 'Não informado'}</Text>
              <Text style={styles.fichaLine}>Gerente: {profile.manager_nome_guerra || 'Sem gerente'}</Text>

              {profile.broker_stage !== 'corretor_creci' && profile.stage_expires_at && (
                <Text style={styles.fichaLine}>
                  📅 Vigência do Estágio: <Text style={styles.boldText}>{fmtDate(profile.stage_expires_at)}</Text>{' '}
                  ({profile.days_until_stage_expiry !== null && profile.days_until_stage_expiry !== undefined ? (profile.days_until_stage_expiry > 0 ? `${profile.days_until_stage_expiry} dias restantes` : 'EXPIRADO') : '—'})
                </Text>
              )}
              {profile.broker_stage === 'corretor_creci' && (
                <Text style={styles.fichaLine}>
                  ⏱️ Último Check-in: <Text style={styles.boldText}>{profile.last_checkin_at ? `${profile.days_since_last_checkin ?? 0} dias atrás (${fmtDate(profile.last_checkin_at)})` : 'Nenhum check-in registrado'}</Text>
                </Text>
              )}
              <Text style={styles.fichaLine}>Status: {profile.status}</Text>

              {profile.is_suspended || profile.is_stage_expired || profile.is_inactive_90d ? (
                <View style={styles.suspensionBox}>
                  <Text style={styles.suspensionTitle}>⚠️ CORRETOR SUSPENSO / BLOQUEADO</Text>
                  <Text style={styles.suspensionText}>{profile.suspension_reason || 'Vigência de estágio expirada ou inatividade superior a 90 dias.'}</Text>
                </View>
              ) : null}

              {!isRh && (
                <View style={styles.leadsStateRow}>
                  <Text style={[styles.leadsStateText, { color: profile.leads_paused ? colors.red700 : colors.green700 }]}>
                    {profile.leads_paused ? 'Leads pausados' : 'Elegível para leads, conforme presença'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={fonts.panelTitle}>Estágio profissional & vigência</Text>
              <Text style={styles.cardSub}>Promova o corretor ou altere seu estágio profissional (real-time):</Text>
              <View style={styles.boothList}>
                {(['treinamento', 'estagiario', 'corretor_creci'] as const).map((s) => {
                  const active = selectedStage === s;
                  return (
                    <TouchableOpacity key={s} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => void updateStage(s)} disabled={saving}>
                      <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{STAGE_LABEL[s]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {profile.broker_stage !== 'corretor_creci' && (
                <>
                  <Text style={styles.fieldLabel}>Renovar prazo de vigência (+dias)</Text>
                  <View style={styles.boothList}>
                    {[30, 60, 90, 180].map((days) => (
                      <TouchableOpacity key={days} style={[styles.boothBtn, { borderColor: colors.navy800, backgroundColor: colors.navy900 }]} onPress={() => void extendStageDays(days)} disabled={saving}>
                        <Text style={{ color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 11 }}>+{days} Dias</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={fonts.panelTitle}>Dados cadastrais</Text>
              <Text style={styles.cardSub}>Será convertido para MAIÚSCULAS e deve ser único no tenant.</Text>
              <Text style={styles.fieldLabel}>Nome de guerra</Text>
              <TextInput style={styles.input} value={nomeGuerra} onChangeText={(v) => setNomeGuerra(v.toLocaleUpperCase('pt-BR'))} placeholderTextColor={colors.slate400} />
              <Text style={styles.fieldLabel}>CRECI</Text>
              <TextInput style={styles.input} value={creci} placeholder="Ex: 123456-F" placeholderTextColor={colors.slate400} onChangeText={(v) => setCreci(v.toUpperCase())} autoCapitalize="characters" />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void updateProfile()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                <Text style={styles.primaryBtnText}>Salvar dados cadastrais</Text>
              </TouchableOpacity>
            </View>

            {!isRh && (
              <View style={styles.card}>
                <Text style={fonts.panelTitle}>Operação de leads</Text>
                <Text style={styles.fieldLabel}>Motivo da ação</Text>
                <TextInput style={[styles.input, styles.multiline]} value={reason} onChangeText={setReason} multiline placeholder="Informe o motivo (mínimo 3 caracteres)" placeholderTextColor={colors.slate400} />
                <View style={styles.editActions}>
                  {profile.leads_paused ? (
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.green700, flex: 1 }]} onPress={() => void setPause(false)} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color={colors.green700} /> : <Play size={13} color={colors.green700} />}
                      <Text style={[styles.actionBtnText, { color: colors.green700 }]}>Retomar leads</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.amber700, flex: 1 }]} onPress={() => void setPause(true)} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color={colors.amber700} /> : <Pause size={13} color={colors.amber700} />}
                      <Text style={[styles.actionBtnText, { color: colors.amber700 }]}>Pausar leads</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.red700, flex: 1 }]} onPress={() => void removeBroker()} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={colors.red700} /> : <Trash2 size={13} color={colors.red700} />}
                    <Text style={[styles.actionBtnText, { color: colors.red700 }]}>Excluir da operação</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={fonts.panelTitle}>Segurança da conta</Text>
              <Text style={styles.cardSub}>Gera uma senha temporária de uso único. O corretor deverá criar nova senha no próximo acesso.</Text>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void resetPassword()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.coral600} /> : <KeyRound size={13} color={colors.coral600} />}
                <Text style={styles.actionBtnText}>Redefinir senha do Corretor</Text>
              </TouchableOpacity>
            </View>

            {!isRh && (
              <View style={styles.card}>
                <Text style={fonts.panelTitle}>Transferência hierárquica</Text>
                <Text style={styles.cardSub}>Somente Gerentes ativos do mesmo tenant podem receber o corretor.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {managers.map((manager) => {
                    const active = selectedManagerId === manager.id;
                    return (
                      <TouchableOpacity key={manager.id} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => setSelectedManagerId(manager.id)}>
                        <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{manager.nome_guerra || manager.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => void transferBroker()} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Users size={14} color="#fff" />}
                  <Text style={styles.primaryBtnText}>Mover para Gerente selecionado</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!!tempPassword && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setTempPassword('')}>
          <View style={styles.modalWrap}>
            <View style={styles.modalBox}>
              <View style={[styles.selPill, { alignSelf: 'flex-start', backgroundColor: colors.amber700 }]}>
                <Text style={styles.selPillText}>SENHA TEMPORÁRIA</Text>
              </View>
              <Text style={styles.modalTitle}>Senha temporária criada</Text>
              <Text style={styles.modalDesc}>Ela expira em 30 minutos e exigirá troca no próximo acesso.</Text>
              <View style={styles.tempPwBox}>
                <Text style={styles.tempPwText} selectable>{tempPassword}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={async () => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(tempPassword);
                  }
                }}
              >
                <Copy size={13} color={colors.blue700} />
                <Text style={styles.copyBtnText}>Copiar senha</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setTempPassword('')}>
                <Text style={styles.primaryBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );

  if (isDesktopSheet && !brokerId) return null;

  if (isDesktopSheet) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.sheetWrap}>
          <TouchableOpacity style={[styles.sheetBackdrop, { left: sidebarOffset, top: topOffset }]} onPress={onClose} activeOpacity={1} />
          <View style={[styles.sheetPanel, { top: topOffset }]}>{renderBody()}</View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={!!brokerId} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: semantic.background }}>{renderBody()}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 16 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  errorBox: { backgroundColor: colors.red100, borderWidth: 1, borderColor: colors.red300, borderRadius: radius.md, padding: 11 },
  errorBoxText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  loadingBox: { padding: 40, alignItems: 'center' },
  emptyBox: { paddingVertical: 14, alignItems: 'center' },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic', marginVertical: 4 },
  card: {
    backgroundColor: semantic.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: 16,
    gap: 10,
    ...shadow.card,
  },
  cardSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  boldText: { fontWeight: '800', color: semantic.textPrimary },
  countPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  countPillText: { fontFamily: font.body, fontWeight: '800', fontSize: 10, letterSpacing: 0.3 },
  kpiRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: semantic.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: 14,
    gap: 2,
    ...shadow.card,
  },
  kpiValue: { color: colors.navy900, fontFamily: font.display, fontWeight: '800', fontSize: 26, letterSpacing: -1 },
  kpiLabel: { color: colors.coral600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  kpiSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10 },
  brokerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  brokerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 13.5 },
  brokerRealName: { color: colors.slate500, fontFamily: font.body, fontSize: 11.5 },
  brokerMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11.5, lineHeight: 16 },
  stageBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  stageBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  actionRowMobile: { flexBasis: '100%', flexShrink: 0 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.coral600,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.coral300,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: semantic.card,
  },
  actionBtnText: { color: colors.coral700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.card,
  },
  tabActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  tabText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  fieldLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11, marginBottom: 5 },
  input: {
    backgroundColor: semantic.card,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    padding: 11,
    fontSize: 13,
    color: semantic.textPrimary,
    fontFamily: font.body,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  boothList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boothBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: colors.slate050,
  },
  boothBtnActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  boothBtnText: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  inviteBanner: {
    backgroundColor: colors.red100,
    borderColor: colors.red300,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  inviteText: { color: colors.blue700, fontFamily: font.body, fontSize: 11.5, lineHeight: 16 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.blue700,
    backgroundColor: '#fff',
  },
  copyBtnText: { color: colors.blue700, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: semantic.card,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: semantic.textPrimary,
    fontFamily: font.body,
  },
  resultCount: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: semantic.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: 13,
    ...shadow.card,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.navy800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  userRight: { alignItems: 'flex-end', marginLeft: 8, gap: 4 },
  roleBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  roleBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  actionPrompt: { fontSize: 11, color: colors.blue700, fontWeight: '700' },
  accordion: {
    backgroundColor: semantic.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  managerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 14 },
  managerEmail: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11 },
  managerHeaderStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamCountBadge: { backgroundColor: colors.slate100, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  teamCountText: { fontSize: 11.5, fontWeight: '700', color: colors.slate700, fontFamily: font.body },
  toggleIcon: { fontSize: 11, color: colors.slate500, fontWeight: '800' },
  teamDrawer: {
    borderTopWidth: 1,
    borderTopColor: semantic.border,
    backgroundColor: colors.slate050,
    padding: 12,
    gap: 8,
  },
  teamDrawerSummary: { fontFamily: font.body, fontWeight: '600', fontSize: 11.5, color: colors.slate600 },
  drawerItem: {
    backgroundColor: semantic.card,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    padding: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '800', fontSize: 13 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: semantic.card, borderRadius: radius.lg, padding: 20, maxWidth: 520, width: '100%', gap: 10, maxHeight: '88%' },
  modalTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 16 },
  modalDesc: { color: colors.amber800, fontFamily: font.body, fontSize: 11.5, lineHeight: 17 },
  templateBtn: { backgroundColor: colors.coral050, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.coral300 },
  templateLabel: { color: colors.blue700, fontSize: 12, fontWeight: '700', fontFamily: font.body },
  warningBox: { backgroundColor: colors.amber100, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: '#EFC36A' },
  warningText: { color: colors.amber800, fontSize: 11.5, lineHeight: 17, fontWeight: '600', fontFamily: font.body },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fichaHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: colors.navy900,
  },
  fichaHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fichaBackBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fichaBackText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  fichaHeaderTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 17, letterSpacing: -0.4 },
  fichaHeaderSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 11.5, marginTop: 2 },
  fichaHeaderMeta: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  fichaHeaderName: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 14 },
  fichaContent: { padding: 16, paddingBottom: 48, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  fichaName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 18 },
  fichaLine: { color: colors.slate600, fontSize: 13, marginBottom: 4, fontFamily: font.body },
  suspensionBox: { backgroundColor: colors.red100, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.red300 },
  suspensionTitle: { color: colors.red700, fontWeight: '800', fontSize: 12.5, fontFamily: font.body },
  suspensionText: { color: colors.red700, fontSize: 11.5, marginTop: 2, fontFamily: font.body },
  leadsStateRow: { marginTop: 8 },
  leadsStateText: { fontWeight: '800', fontFamily: font.body, fontSize: 12 },
  selPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 5 },
  selPillText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  tempPwBox: { backgroundColor: colors.amber100, borderWidth: 1, borderColor: colors.amber700, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  tempPwText: { color: colors.amber900, fontFamily: font.display, fontWeight: '800', fontSize: 18, letterSpacing: 2 },
  sheetWrap: { flex: 1, position: 'relative', backgroundColor: 'transparent' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,20,32,0.35)',
  },
  sheetPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 620,
    maxWidth: '92%',
    backgroundColor: semantic.background,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: -8, height: 0 },
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
});