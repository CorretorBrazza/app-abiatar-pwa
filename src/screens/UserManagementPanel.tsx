import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';

interface ManagedUser { id: string; name: string; nome_guerra: string; email: string; role: string; status: string; }
interface Booth { id: string; name: string; }
interface Props { primaryColor: string; onBack: () => void; }

const roleLabel = (role: string) => role === 'gerencia_level_2' ? 'Gerente' : 'Recepção';

export default function UserManagementPanel({ primaryColor, onBack }: Props) {
  const [tab, setTab] = useState<'gerencia_level_2' | 'recepcao_level_3'>('gerencia_level_2');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNomeGuerra, setNewNomeGuerra] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('12345678');

  const load = async () => {
    try {
      setLoading(true); setError('');
      const [usersRes, boothsRes] = await Promise.all([api.get(`/users/management-users?role=${tab}`), api.get('/booths')]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setBooths(Array.isArray(boothsRes.data) ? boothsRes.data : []);
    } catch (err: any) { setError(err.response?.data?.message || 'Não foi possível carregar os cards.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); setSelected(null); }, [tab]);

  const open = async (person: ManagedUser) => {
    setSelected(person); setName(person.name); setNomeGuerra(person.nome_guerra);
    if (person.role !== 'recepcao_level_3') { setAssigned([]); return; }
    try {
      const results = await Promise.all(booths.map((booth) => api.get(`/booths/${booth.id}/receptionists`)));
      const ids = results.flatMap((res, index) => (Array.isArray(res.data) ? res.data : []).some((item: any) => item.receptionist_id === person.id || item.receptionist?.id === person.id) ? [booths[index].id] : []);
      setAssigned(ids);
    } catch { setAssigned([]); }
  };

  const save = async () => {
    if (!selected) return;
    try { setSaving(true); setError(''); await api.patch(`/users/management-user/${selected.id}`, { name, nomeGuerra }); await load(); setSelected({ ...selected, name, nome_guerra: nomeGuerra.toLocaleUpperCase('pt-BR') }); }
    catch (err: any) { setError(err.response?.data?.message || 'Não foi possível atualizar o perfil.'); }
    finally { setSaving(false); }
  };

  const createReceptionist = async () => {
    if (!newName.trim() || !newNomeGuerra.trim() || !newEmail.trim() || newPassword.length < 8) { setError('Preencha nome, Nome de Guerra, e-mail e uma senha inicial com pelo menos 8 caracteres.'); return; }
    try {
      setSaving(true); setError('');
      await api.post('/users/receptionists', { name: newName.trim(), nomeGuerra: newNomeGuerra, email: newEmail.trim().toLowerCase(), passwordHash: newPassword });
      alert('Recepcionista criada. A senha informada é temporária e deverá ser trocada no primeiro acesso.');
      setNewName(''); setNewNomeGuerra(''); setNewEmail(''); setNewPassword('12345678'); setShowCreate(false); setTab('recepcao_level_3'); await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Não foi possível cadastrar a Recepcionista.'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!selected) return;
    try { setSaving(true); const res = await api.post(`/auth/reset-password/${selected.id}`, { reason: 'Redefinição solicitada pela Diretoria' }); alert(`Senha temporária:\n\n${res.data.temporaryPassword}\n\nExigir troca no próximo acesso.`); }
    catch (err: any) { setError(err.response?.data?.message || 'Não foi possível redefinir a senha.'); }
    finally { setSaving(false); }
  };

  const toggleBooth = async (boothId: string) => {
    if (!selected || selected.role !== 'recepcao_level_3') return;
    try { setSaving(true); if (assigned.includes(boothId)) await api.delete(`/booths/${boothId}/receptionists/${selected.id}`); else await api.post(`/booths/${boothId}/receptionists/${selected.id}`); setAssigned((current) => current.includes(boothId) ? current.filter((id) => id !== boothId) : [...current, boothId]); }
    catch (err: any) { setError(err.response?.data?.message || 'Não foi possível atualizar a atribuição.'); }
    finally { setSaving(false); }
  };

  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <ScreenCode code="DR-04" /><TouchableOpacity onPress={onBack}><Text style={[styles.back, { color: primaryColor }]}>← Voltar ao Dashboard</Text></TouchableOpacity>
    <Text style={styles.title}>Gestão de Usuários</Text><Text style={styles.subtitle}>Cards white label de Gerentes e Recepção</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.tabs}><TouchableOpacity style={[styles.tab, tab === 'gerencia_level_2' && { backgroundColor: primaryColor }]} onPress={() => setTab('gerencia_level_2')}><Text style={[styles.tabText, tab === 'gerencia_level_2' && styles.white]}>Gerentes</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, tab === 'recepcao_level_3' && { backgroundColor: primaryColor }]} onPress={() => setTab('recepcao_level_3')}><Text style={[styles.tabText, tab === 'recepcao_level_3' && styles.white]}>Recepção</Text></TouchableOpacity></View>
    {tab === 'recepcao_level_3' ? <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor, width: '100%', maxWidth: 620, marginBottom: 14 }]} onPress={() => setShowCreate((value) => !value)}><Text style={styles.white}>{showCreate ? 'Fechar cadastro' : 'Cadastrar Recepcionista'}</Text></TouchableOpacity> : null}
    {showCreate && tab === 'recepcao_level_3' ? <View style={styles.editor}><Text style={styles.section}>Nova Recepcionista</Text><Text style={styles.label}>Nome completo</Text><TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Nome completo" /><Text style={styles.label}>Nome de Guerra</Text><TextInput style={styles.input} value={newNomeGuerra} onChangeText={(value) => setNewNomeGuerra(value.toLocaleUpperCase('pt-BR'))} placeholder="NOME DE GUERRA" autoCapitalize="characters" /><Text style={styles.label}>E-mail de acesso</Text><TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="email@empresa.com" keyboardType="email-address" autoCapitalize="none" /><Text style={styles.label}>Senha temporária</Text><Text style={styles.help}>Mínimo de 8 caracteres. A troca será obrigatória no primeiro acesso.</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" /><TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor }]} onPress={() => void createReceptionist()} disabled={saving}><Text style={styles.white}>Criar Recepcionista</Text></TouchableOpacity></View> : null}
    {loading ? <ActivityIndicator size="large" color={primaryColor} /> : users.map((person) => <TouchableOpacity key={person.id} style={styles.card} onPress={() => void open(person)}><Text style={styles.name}>{person.nome_guerra || person.name}</Text><Text style={styles.line}>{person.name}</Text><Text style={styles.line}>{person.email}</Text><Text style={styles.badge}>{roleLabel(person.role)} · {person.status}</Text></TouchableOpacity>)}
    {!loading && users.length === 0 ? <Text style={styles.empty}>Nenhum usuário deste perfil cadastrado.</Text> : null}
    {selected ? <View style={styles.editor}><Text style={styles.section}>Card de {roleLabel(selected.role)}</Text><Text style={styles.label}>Nome completo</Text><TextInput style={styles.input} value={name} onChangeText={setName} /><Text style={styles.label}>Nome de Guerra</Text><TextInput style={styles.input} value={nomeGuerra} onChangeText={(value) => setNomeGuerra(value.toLocaleUpperCase('pt-BR'))} /><TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor }]} onPress={() => void save()} disabled={saving}><Text style={styles.white}>Salvar alterações</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={() => void reset()} disabled={saving}><Text style={styles.secondaryText}>Resetar senha</Text></TouchableOpacity>{selected.role === 'recepcao_level_3' ? <><Text style={styles.section}>Plantões autorizados</Text>{booths.map((booth) => <TouchableOpacity key={booth.id} style={[styles.booth, assigned.includes(booth.id) && { backgroundColor: '#dcfce7', borderColor: '#15803d' }]} onPress={() => void toggleBooth(booth.id)} disabled={saving}><Text style={styles.line}>{assigned.includes(booth.id) ? '✓ ' : ''}{booth.name}</Text></TouchableOpacity>)}</> : null}</View> : null}
  </ScrollView></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f5f5f7' }, content: { padding: 24, paddingBottom: 60, alignItems: 'center' }, back: { alignSelf: 'stretch', fontWeight: '700', fontSize: 16, marginBottom: 18 }, title: { alignSelf: 'stretch', fontSize: 26, fontWeight: '800', color: '#111827' }, subtitle: { alignSelf: 'stretch', color: '#6b7280', marginBottom: 18 }, tabs: { width: '100%', maxWidth: 620, flexDirection: 'row', gap: 8, marginBottom: 16 }, tab: { flex: 1, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, padding: 12, alignItems: 'center' }, tabText: { color: '#111827', fontWeight: '800' }, white: { color: '#fff', fontWeight: '800' }, card: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, marginBottom: 10 }, name: { fontSize: 18, fontWeight: '800', color: '#111827' }, line: { color: '#374151', marginTop: 4 }, badge: { marginTop: 8, color: '#1d4ed8', fontWeight: '700' }, empty: { color: '#6b7280', margin: 24 }, editor: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderRadius: 10, padding: 18, marginTop: 8 }, section: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 12 },   label: { fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 5 }, help: { color: '#6b7280', fontSize: 12, marginBottom: 6 }, input: { height: 46, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, paddingHorizontal: 12, marginBottom: 8 }, primary: { minHeight: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, secondary: { minHeight: 46, borderWidth: 1, borderColor: '#1d4ed8', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, secondaryText: { color: '#1d4ed8', fontWeight: '800' }, booth: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 8 }, error: { width: '100%', maxWidth: 620, color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: '700' } });
