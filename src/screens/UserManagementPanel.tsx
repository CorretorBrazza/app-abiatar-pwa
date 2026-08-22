import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ScreenCode from '../components/ScreenCode';

interface ManagedUser { id: string; name: string; nome_guerra: string; email: string; role: string; status: string; }
interface Booth { id: string; name: string; }
interface Props { primaryColor: string; onBack: () => void; }

const roleLabel = (role: string) => role === 'gerencia_level_2' ? 'Gerente' : 'Recepção';

export default function UserManagementPanel({ primaryColor, onBack }: Props) {
  const { tenant } = useAuth();
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
  const [managerInviteLink, setManagerInviteLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNomeGuerra, setNewNomeGuerra] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('12345678');
  const [newAssigned, setNewAssigned] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const pageSize = Number((tenant as any)?.settings?.pagination?.managementPageSize) || 25;

  const load = async () => {
    try {
      setLoading(true); setError('');
      const [usersRes, boothsRes] = await Promise.all([
        api.get('/users/management-users', { params: { role: tab, page, pageSize, search: search || undefined, status: status || undefined } }),
        api.get('/booths'),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data || []));
      if (usersRes.data?.totalPages) setMeta(usersRes.data);
      setBooths(Array.isArray(boothsRes.data) ? boothsRes.data : []);
    } catch (err: any) { setError(err.response?.data?.message || 'Não foi possível carregar os cards.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); setSelected(null); setShowCreate(false); setManagerInviteLink(''); }, [tab, page, search, status]);

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

  const createManager = async () => {
    if (!newName.trim() || !newNomeGuerra.trim() || !newEmail.trim() || newPassword.length < 8) {
      setError('Preencha nome, Nome de Guerra, e-mail e uma senha inicial com pelo menos 8 caracteres.');
      return;
    }
    try {
      setSaving(true); setError('');
      await api.post('/users/managers', {
        name: newName.trim(),
        nomeGuerra: newNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
      });
      alert('Gerente cadastrado com sucesso! A senha informada é temporária e deverá ser trocada no primeiro acesso.');
      setNewName(''); setNewNomeGuerra(''); setNewEmail(''); setNewPassword('12345678'); setShowCreate(false); await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível cadastrar o Gerente.');
    } finally { setSaving(false); }
  };

  const generateManagerInvite = async () => {
    try {
      setGeneratingInvite(true); setError('');
      const response = await api.post('/users/onboarding-link', { invitedRole: 'gerencia_level_2' });
      const token = response.data.token;
      const origin = (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://abiatar.bitimob.com.br';
      const fullUrl = token ? `${origin}/cadastro/${token}` : response.data.onboarding_url;
      setManagerInviteLink(fullUrl);
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(fullUrl);
        alert(`Link de convite de Gerente gerado e copiado para a área de transferência:\n\n${fullUrl}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível gerar link de convite para Gerente.');
    } finally { setGeneratingInvite(false); }
  };

  const createReceptionist = async () => {
    if (!newName.trim() || !newNomeGuerra.trim() || !newEmail.trim() || newPassword.length < 8) { setError('Preencha nome, Nome de Guerra, e-mail e uma senha inicial com pelo menos 8 caracteres.'); return; }
    try {
      setSaving(true); setError('');
      const response = await api.post('/users/receptionists', { name: newName.trim(), nomeGuerra: newNomeGuerra, email: newEmail.trim().toLowerCase(), passwordHash: newPassword });
      const receptionistId = response.data?.user?.id;
      if (receptionistId && newAssigned.length > 0) {
        await Promise.all(newAssigned.map((boothId) => api.post(`/booths/${boothId}/receptionists/${receptionistId}`)));
      }
      alert('Recepção criada e plantões atribuídos. A senha informada é temporária e deverá ser trocada no primeiro acesso.');
      setNewName(''); setNewNomeGuerra(''); setNewEmail(''); setNewPassword('12345678'); setNewAssigned([]); setShowCreate(false); setTab('recepcao_level_3'); await load();
    } catch (err: any) { setError(err.response?.data?.message || 'Não foi possível cadastrar a Recepção.'); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!selected) return;
    const confirmed = typeof window === 'undefined' ? true : window.confirm(`Excluir ${roleLabel(selected.role)} ${selected.nome_guerra}? O histórico será preservado, mas o acesso será bloqueado.`);
    if (!confirmed) return;
    try { setSaving(true); setError(''); await api.delete(`/users/management-user/${selected.id}`, { data: { reason: 'Exclusão solicitada pela Diretoria' } }); alert('Usuário removido da operação. O histórico foi preservado.'); setSelected(null); await load(); }
    catch (err: any) { setError(err.response?.data?.message || 'Não foi possível excluir o usuário.'); }
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
    
    <View style={styles.tabs}>
      <TouchableOpacity style={[styles.tab, tab === 'gerencia_level_2' && { backgroundColor: primaryColor }]} onPress={() => setTab('gerencia_level_2')}>
        <Text style={[styles.tabText, tab === 'gerencia_level_2' && styles.white]}>Gerentes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tab, tab === 'recepcao_level_3' && { backgroundColor: primaryColor }]} onPress={() => setTab('recepcao_level_3')}>
        <Text style={[styles.tabText, tab === 'recepcao_level_3' && styles.white]}>Recepção</Text>
      </TouchableOpacity>
    </View>

    {tab === 'gerencia_level_2' ? (
      <View style={{ width: '100%', maxWidth: 620, marginBottom: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor, flex: 1, marginTop: 0 }]} onPress={() => setShowCreate((value) => !value)}>
            <Text style={styles.white}>{showCreate ? 'Fechar formulário' : 'Novo Gerente (Direto)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondary, { flex: 1, marginTop: 0 }]} onPress={generateManagerInvite} disabled={generatingInvite}>
            {generatingInvite ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryText}>Gerar Link de Convite</Text>}
          </TouchableOpacity>
        </View>
        {managerInviteLink ? (
          <View style={{ backgroundColor: '#eff6ff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#93c5fd' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e40af', marginBottom: 4 }}>Link de convite de Gerente gerado:</Text>
            <Text style={{ fontSize: 13, color: '#1e3a8a', marginBottom: 8 }} numberOfLines={2}>{managerInviteLink}</Text>
            <TouchableOpacity style={{ backgroundColor: '#2563eb', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }} onPress={() => { if (Platform.OS === 'web') { navigator.clipboard.writeText(managerInviteLink); alert('Link copiado!'); } }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Copiar Link</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    ) : (
      <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor, width: '100%', maxWidth: 620, marginBottom: 14 }]} onPress={() => setShowCreate((value) => !value)}>
        <Text style={styles.white}>{showCreate ? 'Fechar cadastro' : 'Cadastrar Recepção'}</Text>
      </TouchableOpacity>
    )}

    {showCreate && tab === 'gerencia_level_2' ? (
      <View style={styles.editor}>
        <Text style={styles.section}>Novo Gerente</Text>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Nome completo do gerente" />
        <Text style={styles.label}>Nome de Guerra</Text>
        <TextInput style={styles.input} value={newNomeGuerra} onChangeText={(value) => setNewNomeGuerra(value.toLocaleUpperCase('pt-BR'))} placeholder="NOME DE GUERRA" autoCapitalize="characters" />
        <Text style={styles.label}>E-mail de acesso</Text>
        <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="gerente@empresa.com" keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Senha temporária</Text>
        <Text style={styles.help}>Mínimo de 8 caracteres. A troca será obrigatória no primeiro acesso.</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor }]} onPress={() => void createManager()} disabled={saving}>
          <Text style={styles.white}>Criar Gerente</Text>
        </TouchableOpacity>
      </View>
    ) : null}

    {showCreate && tab === 'recepcao_level_3' ? (
      <View style={styles.editor}>
        <Text style={styles.section}>Nova Recepção</Text>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Nome completo" />
        <Text style={styles.label}>Nome de Guerra</Text>
        <TextInput style={styles.input} value={newNomeGuerra} onChangeText={(value) => setNewNomeGuerra(value.toLocaleUpperCase('pt-BR'))} placeholder="NOME DE GUERRA" autoCapitalize="characters" />
        <Text style={styles.label}>E-mail de acesso</Text>
        <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="email@empresa.com" keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Senha temporária</Text>
        <Text style={styles.help}>Mínimo de 8 caracteres. A troca será obrigatória no primeiro acesso.</Text>
        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <Text style={styles.section}>Plantões autorizados no cadastro</Text>
        <Text style={styles.help}>Selecione agora um ou mais plantões. Essa atribuição também poderá ser alterada depois no card da Recepção.</Text>
        {booths.length === 0 ? <Text style={styles.help}>Nenhum plantão disponível para atribuição.</Text> : booths.map((booth) => (
          <TouchableOpacity key={booth.id} style={[styles.booth, newAssigned.includes(booth.id) && { backgroundColor: '#dcfce7', borderColor: '#15803d' }]} onPress={() => setNewAssigned((current) => current.includes(booth.id) ? current.filter((id) => id !== booth.id) : [...current, booth.id])} disabled={saving}>
            <Text style={styles.line}>{newAssigned.includes(booth.id) ? '✓ ' : ''}{booth.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor }]} onPress={() => void createReceptionist()} disabled={saving}>
          <Text style={styles.white}>Criar Recepção</Text>
        </TouchableOpacity>
      </View>
    ) : null}

    <View style={styles.scalableControls}>
      <TextInput value={search} onChangeText={(value) => { setPage(1); setSearch(value); }} placeholder="Buscar por nome, nome de guerra ou e-mail" style={styles.input} />
      <View style={styles.filterRow}>
        {['', 'active', 'inactive'].map((value) => (
          <TouchableOpacity key={value || 'all'} style={[styles.filterButton, status === value && { backgroundColor: primaryColor }]} onPress={() => { setPage(1); setStatus(value); }}>
            <Text style={status === value ? styles.white : styles.filterText}>{value === '' ? 'Todos' : value === 'active' ? 'Ativos' : 'Inativos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>

    {loading ? <ActivityIndicator size="large" color={primaryColor} /> : users.map((person) => (
      <TouchableOpacity key={person.id} style={styles.card} onPress={() => void open(person)}>
        <Text style={styles.name}>{person.nome_guerra || person.name}</Text>
        <Text style={styles.line}>{person.name}</Text>
        <Text style={styles.line}>{person.email}</Text>
        <Text style={styles.badge}>{roleLabel(person.role)} · {person.status}</Text>
      </TouchableOpacity>
    ))}

    {!loading && users.length === 0 ? <Text style={styles.empty}>Nenhum usuário deste perfil cadastrado.</Text> : null}
    {meta.totalPages > 1 ? (
      <View style={styles.pagination}>
        <TouchableOpacity disabled={page <= 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
          <Text style={[styles.pageButton, page <= 1 && styles.pageDisabled]}>← Anterior</Text>
        </TouchableOpacity>
        <Text style={styles.pageLabel}>Página {page} de {meta.totalPages}</Text>
        <TouchableOpacity disabled={page >= meta.totalPages} onPress={() => setPage((value) => Math.min(meta.totalPages, value + 1))}>
          <Text style={[styles.pageButton, page >= meta.totalPages && styles.pageDisabled]}>Próxima →</Text>
        </TouchableOpacity>
      </View>
    ) : null}

    {selected ? (
      <View style={styles.editor}>
        <Text style={styles.section}>Card de {roleLabel(selected.role)}</Text>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
        <Text style={styles.label}>Nome de Guerra</Text>
        <TextInput style={styles.input} value={nomeGuerra} onChangeText={(value) => setNomeGuerra(value.toLocaleUpperCase('pt-BR'))} />
        <TouchableOpacity style={[styles.primary, { backgroundColor: primaryColor }]} onPress={() => void save()} disabled={saving}>
          <Text style={styles.white}>Salvar alterações</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => void reset()} disabled={saving}>
          <Text style={styles.secondaryText}>Resetar senha</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.danger} onPress={() => void remove()} disabled={saving}>
          <Text style={styles.dangerText}>Excluir da operação</Text>
        </TouchableOpacity>
        {selected.role === 'recepcao_level_3' ? (
          <>
            <Text style={styles.section}>Plantões autorizados</Text>
            {booths.map((booth) => (
              <TouchableOpacity key={booth.id} style={[styles.booth, assigned.includes(booth.id) && { backgroundColor: '#dcfce7', borderColor: '#15803d' }]} onPress={() => void toggleBooth(booth.id)} disabled={saving}>
                <Text style={styles.line}>{assigned.includes(booth.id) ? '✓ ' : ''}{booth.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </View>
    ) : null}
  </ScrollView></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f5f5f7' }, content: { padding: 24, paddingBottom: 60, alignItems: 'center' }, back: { alignSelf: 'stretch', fontWeight: '700', fontSize: 16, marginBottom: 18 }, title: { alignSelf: 'stretch', fontSize: 26, fontWeight: '800', color: '#111827' }, subtitle: { alignSelf: 'stretch', color: '#6b7280', marginBottom: 18 }, tabs: { width: '100%', maxWidth: 620, flexDirection: 'row', gap: 8, marginBottom: 16 }, tab: { flex: 1, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, padding: 12, alignItems: 'center' }, tabText: { color: '#111827', fontWeight: '800' }, white: { color: '#fff', fontWeight: '800' }, card: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, marginBottom: 10 }, name: { fontSize: 18, fontWeight: '800', color: '#111827' }, line: { color: '#374151', marginTop: 4 }, badge: { marginTop: 8, color: '#1d4ed8', fontWeight: '700' }, empty: { color: '#6b7280', margin: 24 }, editor: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderRadius: 10, padding: 18, marginTop: 8 }, section: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 12 },   label: { fontWeight: '700', color: '#111827', marginTop: 8, marginBottom: 5 }, help: { color: '#6b7280', fontSize: 12, marginBottom: 6 }, input: { height: 46, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, paddingHorizontal: 12, marginBottom: 8 }, primary: { minHeight: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, secondary: { minHeight: 46, borderWidth: 1, borderColor: '#1d4ed8', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, secondaryText: { color: '#1d4ed8', fontWeight: '800' }, danger: { minHeight: 46, borderWidth: 1, borderColor: '#b91c1c', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 10 }, dangerText: { color: '#b91c1c', fontWeight: '800' }, booth: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 8 }, error: { width: '100%', maxWidth: 620, color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: '700' }, scalableControls: { width: '100%', maxWidth: 620, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 }, filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, filterButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }, filterText: { color: '#111827', fontWeight: '700' }, pagination: { width: '100%', maxWidth: 620, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 }, pageButton: { color: '#1d4ed8', fontWeight: '800' }, pageDisabled: { color: '#9ca3af' }, pageLabel: { color: '#374151', fontWeight: '700' } });
