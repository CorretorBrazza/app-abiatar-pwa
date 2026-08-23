import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ScreenCode from '../components/ScreenCode';

interface Recipient {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  role: string;
  manager_id: string | null;
}

interface Props { primaryColor: string; onBack: () => void; isManager?: boolean; }

type Scope = 'all_users' | 'all_brokers' | 'all_managers' | 'all_receptionists' | 'specific_team' | 'individual';

const labels: Record<Scope, string> = {
  all_users: 'Toda a empresa',
  all_brokers: 'Todos os Corretores',
  all_managers: 'Todos os Gerentes',
  all_receptionists: 'Toda a Recepção',
  specific_team: 'Equipe de um Gerente',
  individual: 'Destinatários específicos',
};

const roleLabel = (role: string) => ({
  diretoria_level_1: 'Diretoria',
  gerencia_level_2: 'Gerente',
  corretor_level_3: 'Corretor',
  recepcao_level_3: 'Recepção',
}[role] || role);

export default function DirectorMessagingPanel({ primaryColor, onBack, isManager = false }: Props) {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [scope, setScope] = useState<Scope>('all_users');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetManagerId, setTargetManagerId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/messages/recipients');
      const loadedRecipients = Array.isArray(response.data) ? response.data : [];
      setRecipients(loadedRecipients.filter((item: Recipient) => item.id !== user?.id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível carregar os destinatários.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadRecipients(); }, []);

  const managerScopeLabels: Record<string, string> = {
    specific_team: 'Toda a minha equipe',
    individual: 'Corretores específicos da equipe',
  };

  const availableScopes = useMemo(() => {
    return isManager ? (['specific_team', 'individual'] as Scope[]) : (Object.keys(labels) as Scope[]);
  }, [isManager]);

  useEffect(() => {
    if (isManager) {
      setScope('specific_team');
      if (user?.id) setTargetManagerId(user.id);
    }
  }, [isManager, user]);

  const filteredIndividualRecipients = useMemo(() => {
    if (isManager) return recipients.filter((item) => item.manager_id === user?.id || item.id === user?.id);
    if (scope === 'individual') return recipients;
    if (scope === 'specific_team' && targetManagerId) return recipients.filter((item) => item.id === targetManagerId || item.manager_id === targetManagerId);
    return [];
  }, [recipients, scope, targetManagerId, isManager, user]);

  const toggleRecipient = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const send = async () => {
    setError(''); setSuccess('');
    if (!title.trim() || !content.trim()) { setError('Informe o título e o conteúdo da mensagem.'); return; }
    if (scope === 'individual' && selectedIds.length === 0) { setError('Selecione pelo menos um destinatário.'); return; }
    const effectiveTargetManagerId = isManager ? user?.id : (scope === 'specific_team' ? targetManagerId : undefined);
    if (scope === 'specific_team' && !effectiveTargetManagerId) { setError('Selecione um Gerente.'); return; }
    try {
      setSending(true);
      const response = await api.post('/messages', {
        title: title.trim(), content: content.trim(), isUrgent: urgent, scope,
        targetManagerId: effectiveTargetManagerId,
        individualRecipientIds: scope === 'individual' ? selectedIds : undefined,
      });
      setSuccess(`${response.data.totalRecipients} destinatário(s) receberam o comunicado. O registro foi salvo no inbox.`);
      setTitle(''); setContent(''); setSelectedIds([]); if (!isManager) setTargetManagerId(''); setUrgent(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível enviar o comunicado.');
    } finally { setSending(false); }
  };

  return (
    <View style={styles.container}>
      <ScreenCode code="DR-03" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Voltar ao Painel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isManager ? 'Comunicação da Minha Equipe' : 'Comunicação Institucional'}</Text>
        <Text style={styles.headerSubtitle}>
          {isManager ? 'Envie comunicados persistentes para os corretores da sua equipe.' : 'Envie comunicados para toda a força de vendas ou equipes específicas.'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={primaryColor} /> : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Destinatários</Text>
              {availableScopes.map((item) => (
                <TouchableOpacity key={item} style={[styles.scopeButton, scope === item && { backgroundColor: primaryColor, borderColor: primaryColor }]} onPress={() => { setScope(item); setSelectedIds([]); if (!isManager) setTargetManagerId(''); }}>
                  <Text style={[styles.scopeText, scope === item && styles.selectedText]}>{isManager ? managerScopeLabels[item] : labels[item]}</Text>
                </TouchableOpacity>
              ))}
              {scope === 'specific_team' && !isManager && <>
                <Text style={styles.label}>Gerente da equipe</Text>
                {recipients.filter((item) => item.role === 'gerencia_level_2').map((manager) => <TouchableOpacity key={manager.id} style={[styles.personButton, targetManagerId === manager.id && { borderColor: primaryColor, backgroundColor: '#eef5ff' }]} onPress={() => setTargetManagerId(manager.id)}><Text style={styles.personName}>{manager.nome_guerra || manager.name}</Text><Text style={styles.personMeta}>Gerente</Text></TouchableOpacity>)}
              </>}
              {scope === 'individual' && <>
                <Text style={styles.label}>Selecione uma ou mais pessoas</Text>
                {filteredIndividualRecipients.map((person) => <TouchableOpacity key={person.id} style={[styles.personButton, selectedIds.includes(person.id) && { borderColor: primaryColor, backgroundColor: '#eef5ff' }]} onPress={() => toggleRecipient(person.id)}><Text style={styles.personName}>{person.nome_guerra || person.name}</Text><Text style={styles.personMeta}>{roleLabel(person.role)} · {person.email}</Text></TouchableOpacity>)}
              </>}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mensagem</Text>
              <Text style={styles.label}>Título</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex.: Reunião geral do plantão" maxLength={150} />
              <Text style={styles.label}>Conteúdo</Text>
              <TextInput style={[styles.input, styles.multiline]} value={content} onChangeText={setContent} placeholder="Escreva o comunicado" multiline maxLength={10000} />
              <TouchableOpacity style={styles.urgentRow} onPress={() => setUrgent(!urgent)}><View style={[styles.checkbox, urgent && { backgroundColor: primaryColor, borderColor: primaryColor }]}>{urgent && <Text style={styles.check}>✓</Text>}</View><View><Text style={styles.urgentTitle}>Exigir leitura</Text><Text style={styles.help}>O destinatário deverá abrir e confirmar a leitura.</Text></View></TouchableOpacity>
              <TouchableOpacity style={[styles.sendButton, { backgroundColor: primaryColor }]} onPress={send} disabled={sending}>{sending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sendText}>Enviar comunicado</Text>}</TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f8' },
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
  content: { padding: 16, paddingBottom: 60, alignItems: 'center' },
  card: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label: { color: '#1f2937', fontWeight: '700', marginTop: 12, marginBottom: 6 },
  scopeButton: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12, marginBottom: 8 },
  scopeText: { color: '#1f2937', fontWeight: '700' },
  selectedText: { color: '#fff' },
  personButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 11, marginBottom: 8 },
  personName: { color: '#111827', fontWeight: '800' },
  personMeta: { color: '#6b7280', fontSize: 12, marginTop: 3 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, paddingHorizontal: 12, color: '#111827', backgroundColor: '#fff', marginBottom: 12 },
  multiline: { minHeight: 120, paddingTop: 10, textAlignVertical: 'top' },
  urgentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 5, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  check: { color: '#fff', fontWeight: '800' },
  urgentTitle: { color: '#111827', fontWeight: '800' },
  help: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  sendButton: { minHeight: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  error: { width: '100%', maxWidth: 620, color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: '700' },
  success: { width: '100%', maxWidth: 620, color: '#166534', backgroundColor: '#dcfce7', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: '700' },
});
