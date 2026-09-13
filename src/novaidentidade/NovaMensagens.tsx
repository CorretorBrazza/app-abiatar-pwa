import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { CheckSquare, ChevronDown, Mail, Send, Square, Users } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow } from './tokens';

type Scope =
  | 'all_users'
  | 'all_brokers'
  | 'all_managers'
  | 'all_receptionists'
  | 'specific_team'
  | 'individual';

interface Recipient {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  role: string;
  manager_id: string | null;
}

const roleLabel = (role: string) => {
  switch (role) {
    case 'diretoria_level_1':
    case 'platform_admin_level_0':
      return 'Diretoria';
    case 'gerencia_level_2':
      return 'Gerente';
    case 'corretor_level_3':
      return 'Corretor';
    case 'recepcao_level_3':
      return 'Recepção';
    case 'rh_level_1':
    case 'rh_level_2':
      return 'RH';
    default:
      return role;
  }
};

export default function NovaMensagens({
  isManager = false,
  isMobile,
}: {
  isManager?: boolean;
  isMobile?: boolean;
}) {
  const { user, tenant } = useAuth();

  const labels: Record<Scope, string> = {
    all_users: 'Toda a empresa',
    all_brokers: 'Todos os Corretores',
    all_managers: 'Todos os Gerentes',
    all_receptionists: 'Toda a Recepção',
    specific_team: 'Equipe de um Gerente',
    individual: 'Destinatários específicos',
  };

  const managerScopeLabels: Partial<Record<Scope, string>> = {
    specific_team: 'Toda a minha equipe',
    individual: 'Corretores específicos da equipe',
  };

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scope, setScope] = useState<Scope>(isManager ? 'specific_team' : 'all_users');
  const [targetManagerId, setTargetManagerId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadRecipients = async () => {
      try {
        const response = await api.get('/messages/recipients');
        if (cancelled) return;
        const raw = Array.isArray(response.data) ? response.data : [];
        setRecipients(raw.filter((r: Recipient) => r.id !== user?.id));
      } catch (err: any) {
        if (!cancelled) setRecipients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRecipients();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const selectScope = (s: Scope) => {
    setScope(s);
    setSelectedIds([]);
    if (!isManager) setTargetManagerId('');
  };

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const personName = (person: Recipient) => person.nome_guerra || person.name;
  const scopeList: Scope[] = isManager ? ['specific_team', 'individual'] : ['all_users', 'all_brokers', 'all_managers', 'all_receptionists', 'specific_team', 'individual'];

  const managers = recipients.filter((r) => r.role === 'gerencia_level_2');

  const filteredIndividualRecipients = isManager
    ? recipients.filter((r) => r.manager_id === user?.id || r.id === user?.id)
    : recipients;

  const effectiveTargetManagerId = isManager ? user?.id : targetManagerId || undefined;

  const handleSend = async () => {
    setError('');
    setSuccess('');
    if (!title.trim()) {
      setError('Informe o título do comunicado.');
      return;
    }
    if (!content.trim()) {
      setError('Escreva o conteúdo do comunicado.');
      return;
    }
    if (scope === 'individual' && selectedIds.length === 0) {
      setError('Selecione ao menos uma pessoa para o envio.');
      return;
    }
    if (scope === 'specific_team' && !isManager && !targetManagerId) {
      setError('Selecione o gerente da equipe destinatária.');
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        isUrgent: urgent,
        scope,
      };
      if (isManager) {
        payload.targetManagerId = user?.id;
      } else if (scope === 'specific_team') {
        payload.targetManagerId = targetManagerId || undefined;
      }
      if (scope === 'individual') payload.individualRecipientIds = selectedIds;

      const response = await api.post('/messages', payload);
      setSuccess(`Comunicado enviado para ${response.data?.totalRecipients ?? 0} pessoa(s).`);
      setTitle('');
      setContent('');
      setSelectedIds([]);
      if (!isManager) setTargetManagerId('');
      setUrgent(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar comunicado.');
    } finally {
      setSending(false);
    }
  };

  const effectiveTargetLabel = effectiveTargetManagerId
    ? recipients.find((r) => r.id === effectiveTargetManagerId && r.role === 'gerencia_level_2')?.nome_guerra
    : null;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
        <View style={styles.heroBadge}>
          <Mail size={12} color="#fff" />
          <Text style={styles.heroBadgeText}>{isManager ? 'Gerência · Minha equipe' : 'Comunicação · Institucional'}</Text>
        </View>
        <Text style={styles.heroTitle}>{isManager ? 'Comunicação da sua equipe.' : 'Comunicação institucional.'}</Text>
        <Text style={styles.heroSubtitle}>
          {isManager
            ? `Envie comunicados persistentes para os corretores da sua equipe.`
            : `Envie comunicados para toda a força de vendas ou equipes específicas.`}
        </Text>
      </View>

      {!!error && (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerErrorText}>{error}</Text>
        </View>
      )}
      {!!success && (
        <View style={[styles.banner, styles.bannerSuccess]}>
          <Text style={styles.bannerSuccessText}>{success}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.coral600} />
          <Text style={styles.loadingText}>Carregando destinatários...</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIconWide}>
                <Users size={15} color={colors.coral600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fonts.panelTitle}>Destinatários</Text>
                <Text style={styles.cardSub}>Escolha o público-alvo do comunicado.</Text>
              </View>
            </View>
            <View style={styles.scopeList}>
              {scopeList.map((s) => {
                const active = scope === s;
                const label = isManager ? managerScopeLabels[s] || labels[s] : labels[s];
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.scopeBtn, active && styles.scopeBtnActive]}
                    onPress={() => selectScope(s)}
                  >
                    <Text style={[styles.scopeBtnText, active && styles.scopeBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {scope === 'specific_team' && !isManager && (
              <>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>Gerente da equipe *</Text>
                <View style={styles.personList}>
                  {managers.length === 0 ? (
                    <Text style={styles.emptyText}>Nenhum gerente cadastrado.</Text>
                  ) : (
                    managers.map((m) => {
                      const active = targetManagerId === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.personBtn, active && styles.personBtnActive]}
                          onPress={() => setTargetManagerId(m.id)}
                        >
                          <Text style={[styles.personName, active && { color: '#fff' }]}>{personName(m)}</Text>
                          <Text style={[styles.personMeta, active && { color: 'rgba(255,255,255,0.75)' }]}>
                            Equipe {m.email}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </>
            )}

            {scope === 'specific_team' && effectiveTargetLabel && !isManager && (
              <Text style={styles.chipText}>
                Enviar para a equipe de <Text style={{ color: colors.coral600, fontWeight: '800' }}>{effectiveTargetLabel}</Text>
              </Text>
            )}

            {scope === 'individual' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>Selecione uma ou mais pessoas *</Text>
                <View style={styles.personList}>
                  {filteredIndividualRecipients.length === 0 ? (
                    <Text style={styles.emptyText}>
                      {isManager ? 'Nenhum corretor vinculado à sua equipe.' : 'Nenhum destinatário disponível.'}
                    </Text>
                  ) : (
                    filteredIndividualRecipients.map((p) => {
                      const active = selectedIds.includes(p.id);
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.personBtn, active && styles.personBtnActive]}
                          onPress={() => toggleRecipient(p.id)}
                        >
                          <View style={styles.checkBox}>
                            {active ? <CheckSquare size={15} color="#fff" /> : <Square size={15} color={colors.slate400} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.personName, active && { color: '#fff' }]}>{personName(p)}</Text>
                            <Text style={[styles.personMeta, active && { color: 'rgba(255,255,255,0.75)' }]}>
                              {roleLabel(p.role)} · {p.email}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIconWide}>
                <ChevronDown size={15} color={colors.coral600} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fonts.panelTitle}>Mensagem</Text>
                <Text style={styles.cardSub}>Escreva o comunicado que será persistido para os destinatários.</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Título *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex.: Reunião geral do plantão"
              placeholderTextColor={colors.slate400}
              maxLength={150}
            />

            <Text style={styles.fieldLabel}>Conteúdo *</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={content}
              onChangeText={setContent}
              placeholder="Escreva o comunicado"
              placeholderTextColor={colors.slate400}
              multiline
              maxLength={10000}
            />

            <TouchableOpacity style={styles.urgentRow} onPress={() => setUrgent(!urgent)}>
              <View style={styles.checkBox}>
                {urgent ? <CheckSquare size={15} color="#fff" /> : <Square size={15} color={colors.slate400} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.urgentLabel}>Exigir leitura</Text>
                <Text style={styles.cardSub}>O destinatário deverá abrir e confirmar a leitura.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => void handleSend()}
              disabled={sending}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={15} color="#fff" />}
              <Text style={styles.sendBtnText}>{sending ? 'Enviando...' : 'Enviar comunicado'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={styles.footerNote}>{tenant?.name || 'ABIATAR'} · Comunicação persistente com validação de leitura.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 820, width: '100%', alignSelf: 'center' },
  hero: {
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.navy900,
    ...shadow.card,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start',
  },
  heroBadgeText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 10, letterSpacing: 0.3 },
  heroTitle: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 23, letterSpacing: -0.8, marginTop: 16 },
  heroSubtitle: { color: '#9EB0C1', fontFamily: font.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
  banner: { padding: 12, borderRadius: radius.md, borderWidth: 1 },
  bannerError: { backgroundColor: colors.red100, borderColor: colors.red300 },
  bannerErrorText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  bannerSuccess: { backgroundColor: colors.green100, borderColor: colors.green500 },
  bannerSuccessText: { color: colors.green800, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  loadingBox: { padding: 40, alignItems: 'center', gap: 10 },
  loadingText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 10, ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWide: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.coral050, alignItems: 'center', justifyContent: 'center',
  },
  cardSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  scopeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scopeBtn: {
    borderWidth: 1, borderColor: colors.coral300, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 13, backgroundColor: semantic.card,
  },
  scopeBtnActive: { backgroundColor: colors.coral600, borderColor: colors.coral600 },
  scopeBtnText: { color: colors.coral700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  scopeBtnTextActive: { color: '#fff' },
  divider: { height: 1, backgroundColor: semantic.border, marginVertical: 2 },
  fieldLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11, marginBottom: 5, marginTop: 2 },
  personList: { gap: 8 },
  personBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 10, backgroundColor: colors.slate050,
  },
  personBtnActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  personName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  personMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  checkBox: { width: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  chipText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11 },
  input: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 11, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  urgentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 10, backgroundColor: colors.slate050,
  },
  urgentLabel: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 13,
  },
  sendBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12.5 },
  footerNote: { textAlign: 'center', color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5, marginTop: 4 },
});