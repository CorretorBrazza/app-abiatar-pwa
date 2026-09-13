import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  Building2,
  CheckCircle2,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { SkeletonBlock, StateEmpty, StateError, StateOffline, StaleBanner } from './components/States';

const CORRECTION_TEMPLATES: Array<{ label: string; text: string }> = [
  { label: 'Documento ilegível', text: 'Os documentos anexados estão ilegíveis. Por favor, reenvie fotos nítidas, sem cortes e sem reflexo.' },
  { label: 'Documento incompleto', text: 'Algum documento foi enviado incompleto ou incorreto. Confira e reenvie o documento faltante ou válido.' },
  { label: 'Residência desatualizada', text: 'O comprovante de residência está desatualizado. Envie uma conta de luz, água ou contrato de aluguel com emissão nos últimos 90 dias.' },
  { label: 'CRECI divergente', text: 'O número do CRECI não pôde ser confirmado ou está divergente. Confira o documento e reenvie.' },
  { label: 'Dados divergentes', text: 'Os dados informados no cadastro não conferem com os documentos anexados. Revise nome, CPF e endereço.' },
];

const STAGES: Array<'treinamento' | 'estagiario' | 'corretor_creci'> = ['treinamento', 'estagiario', 'corretor_creci'];

export default function NovaVisaoRh({ isMobile }: { isMobile?: boolean }) {
  const { user } = useAuth();
  const [brokers, setBrokers] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [boothsCount, setBoothsCount] = useState(0);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editNomeGuerra, setEditNomeGuerra] = useState('');
  const [editCreci, setEditCreci] = useState('');
  const [editStage, setEditStage] = useState<'treinamento' | 'estagiario' | 'corretor_creci'>('treinamento');
  const [editManagerId, setEditManagerId] = useState('');

  const [correctionCandidate, setCorrectionCandidate] = useState<any | null>(null);
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [managersRes, brokersRes, boothsRes, hrReviewRes] = await Promise.all([
        api.get('/users/managers/active'),
        api.get('/users/active-brokers', { params: { pageSize: 500 } }),
        api.get('/booths'),
        api.get('/users/pending-hr-review').catch(() => ({ data: [] })),
      ]);
      setManagers(Array.isArray(managersRes.data) ? managersRes.data : []);
      const brokersData = Array.isArray(brokersRes.data) ? brokersRes.data : brokersRes.data?.data || [];
      setBrokers(brokersData);
      setBoothsCount(Array.isArray(boothsRes.data) ? boothsRes.data.length : 0);
      setPending(Array.isArray(hrReviewRes.data) ? hrReviewRes.data : []);
      setOnline(true);
      setError(false);
      setErrMsg('');
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error('[VISÃORH] Falha ao atualizar pessoas:', err);
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void loadData();
    const intervalId = setInterval(() => { if (!cancelled) void loadData(true); }, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [refreshKey]);

  const handleApprove = async (candidate: any, carenciaDays = 0) => {
    setBusyId(candidate.id);
    try {
      const res = await api.patch(`/users/${candidate.id}/hr-approve`, { carenciaDays });
      alert(res.data?.message || `Corretor ${candidate.nome_guerra} aprovado e ativado para check-in!`);
      void loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao aprovar cadastro.');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenEdit = (candidate: any) => {
    setEditing(candidate);
    setEditName(candidate.name || '');
    setEditNomeGuerra(candidate.nome_guerra || '');
    setEditCreci(candidate.creci || '');
    setEditStage(candidate.broker_stage || 'treinamento');
    setEditManagerId(candidate.manager_id || managers[0]?.id || '');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editNomeGuerra.trim()) {
      alert('Nome de Guerra é obrigatório.');
      return;
    }
    setBusyId(editing.id);
    try {
      await api.patch(`/users/${editing.id}/hr-update`, {
        name: editName.trim(),
        nomeGuerra: editNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        creci: editCreci.trim() ? editCreci.trim().toUpperCase() : null,
        brokerStage: editStage,
        managerId: editManagerId || undefined,
      });
      alert('Dados do candidato atualizados com sucesso!');
      setEditing(null);
      void loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao atualizar dados.');
    } finally {
      setBusyId(null);
    }
  };

  const handleHardDelete = async (candidate: any) => {
    const confirmed =
      typeof window === 'undefined' || window.confirm(
        `Excluir DEFINITIVAMENTE o cadastro de ${candidate.nome_guerra}?\n\nEsta ação apagará o cadastro e LIBERARÁ o Nome de Guerra e o E-mail imediatamente para novo uso.`,
      );
    if (!confirmed) return;
    setBusyId(candidate.id);
    try {
      const res = await api.delete(`/users/${candidate.id}/hard-delete`);
      alert(res.data?.message || 'Cadastro excluído com sucesso.');
      void loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao excluir cadastro.');
    } finally {
      setBusyId(null);
    }
  };

  const handleNotifyCorrection = async () => {
    if (!correctionCandidate) return;
    if (correctionMessage.trim().length < 3) {
      alert('Escreva o motivo da correção (mínimo 3 caracteres).');
      return;
    }
    setCorrectionLoading(true);
    try {
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

  if (loading && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <SkeletonBlock lines={1} height={140} />
        <SkeletonBlock lines={2} height={240} />
      </ScrollView>
    );
  }

  if (error && !lastUpdated) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StateError message="Não foi possível carregar a visão de pessoas." onRetry={() => { setLoading(true); setRefreshKey((k) => k + 1); }} />
      </ScrollView>
    );
  }

  const activeCount = brokers.filter((b) => b.status === 'active').length;
  const graceCount = brokers.filter((b) => b.status === 'grace_period').length;
  const expiredCount = brokers.filter((b) => b.is_stage_expired).length;

  const kpis = [
    { label: 'Corretores cadastrados', value: brokers.length, tone: 'info' as const, icon: Users },
    { label: 'Ativos', value: activeCount, tone: 'positive' as const, icon: UserCheck },
    { label: 'Em carência', value: graceCount, tone: 'attention' as const, icon: ShieldCheck },
    { label: 'Com estágio vencido', value: expiredCount, tone: 'danger' as const, icon: ShieldCheck },
    { label: 'Gerências ativas', value: managers.length, tone: 'action' as const, icon: Users },
    { label: 'Plantões cadastrados', value: boothsCount, tone: 'neutral' as const, icon: Building2 },
  ];

  return (
    <View style={{ flex: 1 }}>
      {!online && <StateOffline updatedAt={lastUpdated || undefined} onRetry={() => setRefreshKey((k) => k + 1)} />}
      {errMsg ? <Text style={styles.errText}>{errMsg}</Text> : null}

      {editing && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditing(null)}>
          <View style={styles.modalWrap}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Ajustar cadastro na triagem</Text>
              <Text style={styles.modalDesc}>Faça as correções cadastrais necessárias antes de encaminhar para a gerência.</Text>

              <ScrollView style={{ maxHeight: '70%' }}>
                <Text style={styles.fieldLabel}>Nome completo</Text>
                <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nome completo" />

                <Text style={styles.fieldLabel}>Nome de guerra *</Text>
                <TextInput
                  style={styles.input}
                  value={editNomeGuerra}
                  onChangeText={(v) => setEditNomeGuerra(v.toLocaleUpperCase('pt-BR'))}
                  placeholder="NOME DE GUERRA"
                  autoCapitalize="characters"
                />

                <Text style={styles.fieldLabel}>Estágio profissional</Text>
                <View style={styles.stageRow}>
                  {STAGES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageBtn, editStage === s && styles.stageBtnActive]}
                      onPress={() => setEditStage(s)}
                    >
                      <Text style={[styles.stageBtnText, editStage === s && styles.stageBtnTextActive]}>
                        {s === 'treinamento' ? 'Treinamento' : s === 'estagiario' ? 'Estagiário' : 'Corretor CRECI'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Número do CRECI</Text>
                <TextInput
                  style={styles.input}
                  value={editCreci}
                  onChangeText={(v) => setEditCreci(v.toUpperCase())}
                  placeholder="Ex: 123456-F"
                  autoCapitalize="characters"
                />

                <Text style={styles.fieldLabel}>Gerente responsável</Text>
                <select
                  style={{ width: '100%', padding: '9px 11px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', backgroundColor: '#fff', fontFamily: 'DM Sans' } as any}
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      Gerente {m.nome_guerra || m.name}
                    </option>
                  ))}
                </select>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={!!busyId}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleSaveEdit()} disabled={!!busyId}>
                  <Text style={styles.primaryBtnText}>{busyId === editing?.id ? 'Salvando...' : 'Salvar ajustes'}</Text>
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
              <Text style={styles.modalTitle}>Solicitar correção de documentos</Text>
              <Text style={styles.modalDesc}>
                Um e-mail será enviado para <Text style={{ fontWeight: '800' }}>{correctionCandidate.nome_guerra}</Text> ({correctionCandidate.email}) solicitando o reenvio da documentação.
              </Text>

              <View style={{ gap: 6 }}>
                {CORRECTION_TEMPLATES.map((tpl) => (
                  <TouchableOpacity key={tpl.label} style={styles.tplBtn} onPress={() => setCorrectionMessage(tpl.text)}>
                    <Text style={styles.tplBtnText}>{tpl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Motivo / texto do e-mail *</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={correctionMessage}
                onChangeText={setCorrectionMessage}
                placeholder="Descreva o que precisa ser corrigido na documentação..."
                multiline
              />

              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  O e-mail informará ao corretor: "Não responda este e-mail. Envie a documentação que está faltando para gestaoautonomos@abiatar.com".
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setCorrectionCandidate(null)} disabled={correctionLoading}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.amber700 }]} onPress={() => void handleNotifyCorrection()} disabled={correctionLoading}>
                  <Text style={styles.primaryBtnText}>{correctionLoading ? 'Enviando...' : 'Enviar e-mail'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <UserCheck size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>RH · Governança de pessoas</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Visão RH, {user?.nome_guerra ? user.nome_guerra : 'coordenação'}.</Text>
          <Text style={styles.heroSubtitle}>Aprove cadastros e acompanhe a saúde do quadro de corretores.</Text>
        </View>

        <View style={styles.kpiGrid}>
          {kpis.map((k) => {
            const t = statusTone[k.tone];
            const Icon = k.icon;
            return (
              <View key={k.label} style={[styles.kpiCard, { width: isMobile ? '48%' : undefined, flex: isMobile ? undefined : 1 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: t.bg }]}>
                  <Icon size={15} color={t.fg} />
                </View>
                <Text style={fonts.metricValueMobile}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={fonts.panelTitle}>Aprovação de novos cadastros ({pending.length})</Text>
            <Text style={styles.sectionSub}>Aprovação centralizada no RH. Ao aprovar, o corretor é ativado e liberado para check-in.</Text>
          </View>
        </View>

        {pending.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhum corretor aguardando aprovação no momento.</Text>
          </View>
        ) : (
          <View style={styles.pendingList}>
            {pending.map((candidate) => {
              const busy = busyId === candidate.id;
              return (
                <View key={candidate.id} style={styles.pendingCard}>
                  <View style={styles.pendingHead}>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={styles.pendingName}>
                        {candidate.nome_guerra} <Text style={styles.pendingRealName}>({candidate.name})</Text>
                      </Text>
                      <Text style={styles.pendingMeta}>📧 {candidate.email} · CRECI: {candidate.creci || '—'}</Text>
                      <Text style={styles.pendingMeta}>Equipe: {candidate.manager_nome_guerra || 'Sem gerente'}</Text>
                      <Text style={styles.pendingMeta}>Enviado em: {new Date(candidate.created_at).toLocaleString('pt-BR')}</Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: colors.blue100 }]}>
                      <Text style={[styles.chipText, { color: colors.blue700 }]}>Pendente</Text>
                    </View>
                  </View>

                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionApprove, busy && styles.actionBusy]}
                      disabled={busy}
                      onPress={() => void handleApprove(candidate, 0)}
                    >
                      <CheckCircle2 size={14} color="#fff" />
                      <Text style={styles.actionText}>{busy ? '...' : 'Aprovar e ativar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionNeutral, busy && styles.actionBusy]}
                      disabled={busy}
                      onPress={() => handleOpenEdit(candidate)}
                    >
                      <Pencil size={13} color={colors.slate700} />
                      <Text style={[styles.actionText, { color: colors.slate700 }]}>Ajustar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionWarn, busy && styles.actionBusy]}
                      disabled={busy}
                      onPress={() => {
                        setCorrectionCandidate(candidate);
                        setCorrectionMessage('');
                      }}
                    >
                      <Mail size={13} color={colors.amber700} />
                      <Text style={[styles.actionText, { color: colors.amber700 }]}>Correção</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionDanger, busy && styles.actionBusy]}
                      disabled={busy}
                      onPress={() => void handleHardDelete(candidate)}
                    >
                      <Trash2 size={13} color="#fff" />
                      <Text style={styles.actionText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footerRow}>
          {lastUpdated && <StaleBanner updatedAt={lastUpdated} />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 18 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 5, ...shadow.card, minWidth: 130,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 10.5, lineHeight: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6, gap: 10 },
  sectionSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16, marginTop: 2, flexShrink: 1 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, ...shadow.card,
  },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  pendingList: { gap: 12 },
  pendingCard: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 12, ...shadow.card,
  },
  pendingHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  pendingName: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 14 },
  pendingRealName: { color: semantic.textMuted, fontFamily: font.body, fontWeight: '500', fontSize: 12 },
  pendingMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  chipText: { fontFamily: font.body, fontWeight: '700', fontSize: 9.5 },
  pendingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.md },
  actionApprove: { backgroundColor: colors.green700 },
  actionNeutral: { backgroundColor: colors.slate100 },
  actionWarn: { backgroundColor: colors.amber100 },
  actionDanger: { backgroundColor: colors.red700 },
  actionBusy: { opacity: 0.5 },
  actionText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  footerRow: { alignItems: 'center' },
  errText: { color: colors.red700, fontFamily: font.body, fontSize: 12, paddingHorizontal: 24, paddingTop: 8 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: semantic.card, borderRadius: radius.lg, padding: 20, width: '100%', maxWidth: 520, maxHeight: '92%' },
  modalTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 16 },
  modalDesc: { color: colors.coral600, fontFamily: font.body, fontSize: 11.5, lineHeight: 17, marginVertical: 10 },
  fieldLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11, marginBottom: 5, marginTop: 9 },
  input: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 10, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  stageRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stageBtn: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.sm, backgroundColor: colors.slate100 },
  stageBtnActive: { backgroundColor: colors.navy800 },
  stageBtnText: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  stageBtnTextActive: { color: '#fff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border },
  cancelBtnText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  primaryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.coral600 },
  primaryBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  tplBtn: { backgroundColor: colors.slate050, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: semantic.border },
  tplBtnText: { color: colors.navy800, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  warnBox: { backgroundColor: colors.amber100, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.amber700, marginTop: 10 },
  warnText: { color: colors.amber700, fontFamily: font.body, fontSize: 10.5, lineHeight: 16 },
});