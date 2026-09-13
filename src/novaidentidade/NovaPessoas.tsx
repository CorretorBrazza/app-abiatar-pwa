import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
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
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import NovaGestaoCorretores from './NovaGestaoCorretores';

type TabKey = 'gerencia_level_2' | 'recepcao_level_3' | 'rh_level_2' | 'corretor_level_3';

const TAB_LABEL: Record<TabKey, string> = {
  gerencia_level_2: 'Gerentes',
  recepcao_level_3: 'Recepção',
  rh_level_2: 'RH',
  corretor_level_3: 'Corretores',
};

const roleLabel = (role: string) =>
  role === 'gerencia_level_2'
    ? 'Gerente'
    : role === 'rh_level_2' || role === 'rh_level_1'
      ? 'Recursos Humanos (RH)'
      : 'Recepção';

interface ManagedUser {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  role: string;
  status: string;
}

interface Meta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function NovaPessoas({ isMobile, sidebarOffset = 0, topOffset = 0 }: { isMobile?: boolean; sidebarOffset?: number; topOffset?: number }) {
  const { tenant, user } = useAuth();
  const isExecutive = user?.role === 'diretoria_level_1' || user?.role === 'platform_admin_level_0';
  const visibleTabs: TabKey[] = isExecutive
    ? ['gerencia_level_2', 'recepcao_level_3', 'rh_level_2', 'corretor_level_3']
    : ['gerencia_level_2', 'recepcao_level_3', 'rh_level_2'];
  const [tab, setTab] = useState<TabKey>('gerencia_level_2');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booths, setBooths] = useState<any[]>([]);

  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [assigned, setAssigned] = useState<string[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNomeGuerra, setNewNomeGuerra] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('12345678');
  const [newAssigned, setNewAssigned] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [inviteLink, setInviteLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [copiedPw, setCopiedPw] = useState(false);

  const pageSize =
    typeof (tenant?.settings as any)?.pagination?.managementPageSize === 'number'
      ? (tenant?.settings as any).pagination.managementPageSize
      : 25;

  const clearForm = () => {
    setNewName('');
    setNewNomeGuerra('');
    setNewEmail('');
    setNewPassword('12345678');
    setNewAssigned([]);
    setCreateError('');
  };

  const load = useCallback(async () => {
    if (tab === 'corretor_level_3') return;
    setLoading(true);
    setError('');
    try {
      const [usersRes, boothsRes] = await Promise.all([
        api.get('/users/management-users', {
          params: {
            role: tab,
            page,
            pageSize,
            search: search.trim() || undefined,
            status: status || undefined,
          },
        }),
        api.get('/booths'),
      ]);
      const data = usersRes.data;
      const list = Array.isArray(data) ? data : data.data || [];
      setUsers(list);
      if (data?.totalPages) setMeta(data);
      setBooths(Array.isArray(boothsRes.data) ? boothsRes.data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, status, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, status]);

  useEffect(() => {
    setInviteLink('');
  }, [tab, page, search, status]);

  const open = async (person: ManagedUser) => {
    if (selected?.id === person.id) {
      setSelected(null);
      setAssigned([]);
      return;
    }
    setSelected(person);
    setName(person.name);
    setNomeGuerra(person.nome_guerra);
    setAssigned([]);
    if (person.role === 'recepcao_level_3' && booths.length > 0) {
      try {
        const results = await Promise.all(
          booths.map((b) => api.get(`/booths/${b.id}/receptionists`).catch(() => ({ data: [] }))),
        );
        const list = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
        setAssigned(
          booths
            .filter((b, i) => {
              const items = results[i]?.data;
              return Array.isArray(items) && items.some((item: any) => item.receptionist_id === person.id || item.receptionist?.id === person.id);
            })
            .map((b) => b.id),
        );
        void list;
      } catch {
        setAssigned([]);
      }
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/users/management-user/${selected.id}`, {
        name: name.trim(),
        nomeGuerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR'),
      });
      setSelected((s) => (s ? { ...s, name: name.trim(), nome_guerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR') } : s));
      void load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!selected) return;
    try {
      const res = await api.post(`/auth/reset-password/${selected.id}`, {
        reason: 'Redefinição solicitada pela Diretoria',
      });
      setTempPassword(res.data?.temporaryPassword || '');
      setCopiedPw(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao resetar senha.');
    }
  };

  const remove = async () => {
    if (!selected) return;
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Excluir ${roleLabel(selected.role)} ${selected.nome_guerra}?\nO histórico será preservado, mas o acesso será bloqueado.`);
    if (!confirmed) return;
    setRemoving(true);
    try {
      await api.delete(`/users/management-user/${selected.id}`, {
        data: { reason: 'Exclusão solicitada pela Diretoria' },
      });
      alert('Usuário removido da operação. O histórico foi preservado.');
      setSelected(null);
      setAssigned([]);
      void load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao excluir usuário.');
    } finally {
      setRemoving(false);
    }
  };

  const validateCreate = () => {
    if (!newName.trim() || !newNomeGuerra.trim() || !newEmail.trim() || !newPassword) {
      return 'Preencha todos os campos obrigatórios.';
    }
    if (newPassword.length < 8) return 'A senha temporária deve ter no mínimo 8 caracteres.';
    return '';
  };

  const createManager = async () => {
    const check = validateCreate();
    if (check) {
      setCreateError(check);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/users/managers', {
        name: newName.trim(),
        nomeGuerra: newNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: newEmail.trim().toLocaleLowerCase('pt-BR'),
        passwordHash: newPassword,
      });
      alert('Gerente cadastrado com sucesso! A senha informada é temporária.');
      clearForm();
      setShowCreate(false);
      void load();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Erro ao cadastrar gerente.');
    } finally {
      setCreating(false);
    }
  };

  const generateManagerInvite = async () => {
    setGeneratingInvite(true);
    try {
      const response = await api.post('/users/onboarding-link', { invitedRole: 'gerencia_level_2' });
      const token = response.data.token;
      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : 'https://abiatar.bitimob.com.br';
      const link = token ? `${origin}/cadastro/${token}` : response.data.onboarding_url;
      setInviteLink(link);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert(`Link de convite gerado e copiado:\n${link}`);
      } else {
        alert(`Link de convite gerado:\n${link}`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao gerar link de convite.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const createReceptionist = async () => {
    const check = validateCreate();
    if (check) {
      setCreateError(check);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const response = await api.post('/users/receptionists', {
        name: newName.trim(),
        nomeGuerra: newNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: newEmail.trim().toLocaleLowerCase('pt-BR'),
        passwordHash: newPassword,
      });
      const receptionistId = response.data?.user?.id;
      if (receptionistId && newAssigned.length > 0) {
        await Promise.all(
          newAssigned.map((boothId) =>
            api.post(`/booths/${boothId}/receptionists/${receptionistId}`).catch((e) => {
              console.error('Falha ao atribuir recepção ao plantão:', e);
            }),
          ),
        );
      }
      alert('Recepção cadastrada com sucesso!');
      clearForm();
      setShowCreate(false);
      setTab('recepcao_level_3');
      void load();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Erro ao cadastrar recepção.');
    } finally {
      setCreating(false);
    }
  };

  const createRhUser = async () => {
    const check = validateCreate();
    if (check) {
      setCreateError(check);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/users/rh', {
        name: newName.trim(),
        nomeGuerra: newNomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: newEmail.trim().toLocaleLowerCase('pt-BR'),
        passwordHash: newPassword,
      });
      alert('Usuário de RH cadastrado com sucesso!');
      clearForm();
      setShowCreate(false);
      setTab('rh_level_2');
      void load();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Erro ao cadastrar usuário de RH.');
    } finally {
      setCreating(false);
    }
  };

  const toggleBooth = async (boothId: string) => {
    if (!selected) return;
    const isAssigned = assigned.includes(boothId);
    if (isAssigned) {
      try {
        const res = await api.delete(`/booths/${boothId}/receptionists/${selected.id}`);
        if (res.data?.removed !== false) setAssigned((prev) => prev.filter((x) => x !== boothId));
      } catch (err: any) {
        alert(err.response?.data?.message || 'Erro ao desatribuir plantão.');
      }
    } else {
      try {
        await api.post(`/booths/${boothId}/receptionists/${selected.id}`);
        setAssigned((prev) => [...prev, boothId]);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Erro ao atribuir plantão.');
      }
    }
  };

  const toggleNewAssigned = (boothId: string) => {
    setNewAssigned((prev) => (prev.includes(boothId) ? prev.filter((x) => x !== boothId) : [...prev, boothId]));
  };

  const copyInvite = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
      alert('Link de convite copiado!');
    }
  };

  const pageSizeHint = `Mínimo de 8 caracteres. A troca será obrigatória no primeiro acesso.`;

  const renderCreateForm = (submitLabel: string, onSubmit: () => void, withBooths: boolean) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={fonts.panelTitle}>{submitLabel}</Text>
        <TouchableOpacity onPress={() => { setShowCreate(false); setCreateError(''); }}>
          <X size={16} color={colors.slate500} />
        </TouchableOpacity>
      </View>
      {!!createError && (
        <View style={[styles.errorBox]}>
          <Text style={styles.errorBoxText}>{createError}</Text>
        </View>
      )}
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Nome completo *</Text>
          <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Nome completo" placeholderTextColor={colors.slate400} />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Nome de Guerra *</Text>
          <TextInput
            style={styles.input}
            value={newNomeGuerra}
            onChangeText={(v) => setNewNomeGuerra(v.toLocaleUpperCase('pt-BR'))}
            placeholder="NOME DE GUERRA"
            placeholderTextColor={colors.slate400}
            autoCapitalize="characters"
          />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>E-mail de acesso *</Text>
          <TextInput
            style={styles.input}
            value={newEmail}
            onChangeText={(v) => setNewEmail(v.toLocaleLowerCase('pt-BR'))}
            placeholder="acesso@email.com"
            placeholderTextColor={colors.slate400}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Senha temporária *</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        </View>
      </View>
      <Text style={styles.helpText}>{pageSizeHint}</Text>

      {withBooths && (
        <>
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>Plantões autorizados no cadastro</Text>
          {booths.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum plantão disponível para atribuição.</Text>
          ) : (
            <View style={styles.boothList}>
              {booths.map((b) => {
                const active = newAssigned.includes(b.id);
                return (
                  <TouchableOpacity key={b.id} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => toggleNewAssigned(b.id)}>
                    {active ? <CheckCircle2 size={14} color="#fff" /> : <Plus size={14} color={colors.slate400} />}
                    <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{b.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={() => void onSubmit()} disabled={creating}>
        {creating ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
        <Text style={styles.primaryBtnText}>{creating ? 'Cadastrando...' : submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActionBar = () => {
    if (tab === 'corretor_level_3') return null;
    if (tab === 'gerencia_level_2') {
      return (
        <View style={styles.actionBar}>
          <TouchableOpacity style={[styles.actionBtn, showCreate && styles.actionBtnActive]} onPress={() => { setShowCreate(!showCreate); setCreateError(''); }}>
            <UserPlus size={14} color={showCreate ? '#fff' : colors.coral600} />
            <Text style={[styles.actionBtnText, showCreate && { color: '#fff' }]}>Novo Gerente (Direto)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => void generateManagerInvite()} disabled={generatingInvite}>
            {generatingInvite ? <ActivityIndicator size="small" color={colors.coral600} /> : <Link2 size={14} color={colors.coral600} />}
            <Text style={styles.actionBtnText}>Gerar Link de Convite</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (tab === 'recepcao_level_3') {
      return (
        <View style={styles.actionBar}>
          <TouchableOpacity style={[styles.actionBtn, showCreate && styles.actionBtnActive]} onPress={() => { setShowCreate(!showCreate); setCreateError(''); }}>
            <UserPlus size={14} color={showCreate ? '#fff' : colors.coral600} />
            <Text style={[styles.actionBtnText, showCreate && { color: '#fff' }]}>Cadastrar Recepção</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionBtn, showCreate && styles.actionBtnActive]} onPress={() => { setShowCreate(!showCreate); setCreateError(''); }}>
          <UserPlus size={14} color={showCreate ? '#fff' : colors.coral600} />
          <Text style={[styles.actionBtnText, showCreate && { color: '#fff' }]}>Cadastrar Usuário de RH</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundImage: 'linear-gradient(135deg, #2F4A60 0%, #17212B 60%, #101C2A 100%)' } as any]}>
          <View style={styles.heroBadge}>
            <Users size={12} color="#fff" />
            <Text style={styles.heroBadgeText}>
              {tab === 'corretor_level_3' ? 'Diretoria · Gestão Executiva de Corretores' : 'Diretoria · Gestão de usuários'}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{tab === 'corretor_level_3' ? 'Estrutura comercial.' : 'Controle de acessos.'}</Text>
          <Text style={styles.heroSubtitle}>
            {tab === 'corretor_level_3'
              ? 'Hierarquia por gerência, aprovação de cadastros, convites e ficha individual do corretor.'
              : 'Gerentes, Recepção e RH com permissões claras e reutilizáveis.'}
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        )}

        {!!inviteLink && (
          <View style={[styles.card, styles.inviteBanner]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.inviteLabel}>Link de convite gerado</Text>
              <Text style={styles.inviteText} numberOfLines={2}>{inviteLink}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={() => void copyInvite()}>
              <Copy size={13} color={colors.blue700} />
              <Text style={styles.copyBtnText}>Copiar Link</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabs}>
          {visibleTabs.map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{TAB_LABEL[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'corretor_level_3' ? (
          <NovaGestaoCorretores hideTitle isMobile={isMobile} sidebarOffset={sidebarOffset} topOffset={topOffset} />
        ) : (
          <>
        {renderActionBar()}

        {showCreate && tab === 'gerencia_level_2' && renderCreateForm('Criar Gerente', createManager, false)}
        {showCreate && tab === 'recepcao_level_3' && renderCreateForm('Criar Recepção', createReceptionist, true)}
        {showCreate && tab === 'rh_level_2' && renderCreateForm('Criar Usuário de RH', createRhUser, false)}

        <View style={styles.filterBar}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome, nome de guerra ou e-mail"
            placeholderTextColor={colors.slate400}
          />
          <View style={styles.statusRow}>
            {[
              { key: '', label: 'Todos' },
              { key: 'active', label: 'Ativos' },
              { key: 'inactive', label: 'Inativos' },
            ].map((s) => (
              <TouchableOpacity key={s.key} style={[styles.statusChip, status === s.key && styles.statusChipActive]} onPress={() => setStatus(s.key)}>
                <Text style={[styles.statusChipText, status === s.key && styles.statusChipTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.coral600} />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Nenhum usuário deste perfil cadastrado.</Text>
          </View>
        ) : (
          <View style={styles.userList}>
            {users.map((person) => {
              const isSel = selected?.id === person.id;
              return (
                <TouchableOpacity key={person.id} style={[styles.userCard, isSel && styles.userCardSelected]} onPress={() => void open(person)}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{(person.nome_guerra || '?').charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, isSel && { color: colors.coral600 }]}>{person.nome_guerra || person.name}</Text>
                      {isSel && (
                        <View style={[styles.selPill, { backgroundColor: colors.coral600 }]}>
                          <Text style={styles.selPillText}>SELECIONADO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.userMeta}>{person.name}</Text>
                    <Text style={styles.userMeta}>{person.email}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: statusTone[person.status === 'active' ? 'positive' : 'danger'].bg }]}>
                    <Text style={[styles.roleBadgeText, { color: statusTone[person.status === 'active' ? 'positive' : 'danger'].fg }]}>
                      {roleLabel(person.role)} · {person.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!!meta && meta.totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]} disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              <Text style={styles.pageBtnText}>← Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>{`Página ${meta.page} de ${meta.totalPages}`}</Text>
            <TouchableOpacity style={[styles.pageBtn, page >= meta.totalPages && { opacity: 0.4 }]} disabled={page >= meta.totalPages} onPress={() => setPage((p) => p + 1)}>
              <Text style={styles.pageBtnText}>Próxima →</Text>
            </TouchableOpacity>
          </View>
        )}

        {selected && (
          <View style={[styles.card, styles.editCard]}>
            <Text style={fonts.panelTitle}>Card de {roleLabel(selected.role)}</Text>
            <Text style={styles.cardSub}>Edite os dados, redefina a senha ou remova o acesso.</Text>

            <Text style={styles.fieldLabel}>Nome completo</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor={colors.slate400} />

            <Text style={styles.fieldLabel}>Nome de Guerra</Text>
            <TextInput
              style={styles.input}
              value={nomeGuerra}
              onChangeText={(v) => setNomeGuerra(v.toLocaleUpperCase('pt-BR'))}
              placeholder="NOME DE GUERRA"
              placeholderTextColor={colors.slate400}
              autoCapitalize="characters"
            />

            {selected.role === 'recepcao_level_3' && (
              <>
                <View style={styles.divider} />
                <Text style={styles.fieldLabel}>Plantões autorizados</Text>
                {booths.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum plantão disponível.</Text>
                ) : (
                  <View style={styles.boothList}>
                    {booths.map((b) => {
                      const active = assigned.includes(b.id);
                      return (
                        <TouchableOpacity key={b.id} style={[styles.boothBtn, active && styles.boothBtnActive]} onPress={() => void toggleBooth(b.id)}>
                          {active ? <CheckCircle2 size={14} color="#fff" /> : <Plus size={14} color={colors.slate400} />}
                          <Text style={[styles.boothBtnText, active && { color: '#fff' }]}>{b.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => void save()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                <Text style={styles.primaryBtnText}>Salvar alterações</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.amber700 }]} onPress={() => void reset()}>
                <KeyRound size={14} color={colors.amber700} />
                <Text style={[styles.actionBtnText, { color: colors.amber700 }]}>Resetar senha</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.red700 }]} onPress={() => void remove()} disabled={removing}>
                {removing ? <ActivityIndicator size="small" color={colors.red700} /> : <Trash2 size={14} color={colors.red700} />}
                <Text style={[styles.actionBtnText, { color: colors.red700 }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        </>
        )}

        {tempPassword ? (
          <View style={styles.card}>
            <View style={[styles.selPill, { alignSelf: 'flex-start', backgroundColor: colors.amber700 }]}>
              <Text style={styles.selPillText}>SENHA TEMPORÁRIA</Text>
            </View>
            <Text style={fonts.panelTitle}>Senha temporária criada</Text>
            <Text style={styles.cardSub}>Ela expira em 30 minutos e exigirá troca no próximo acesso.</Text>
            <View style={styles.tempPwBox}>
              <Text style={styles.tempPwText} selectable>{tempPassword}</Text>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={async () => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(tempPassword);
                  }
                  setCopiedPw(true);
                  setTimeout(() => setCopiedPw(false), 2000);
                }}
              >
                <Copy size={13} color={colors.blue700} />
                <Text style={styles.copyBtnText}>{copiedPw ? '✔ Senha copiada!' : 'Copiar senha'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setTempPassword('')}>
                <Text style={styles.primaryBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!tempPassword} transparent animationType="fade" onRequestClose={() => setTempPassword('')}>
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
              style={styles.fullCopyBtn}
              onPress={async () => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  await navigator.clipboard.writeText(tempPassword);
                }
                setCopiedPw(true);
                setTimeout(() => setCopiedPw(false), 2000);
              }}
            >
              <Copy size={13} color={colors.blue700} />
              <Text style={styles.copyBtnText}>{copiedPw ? '✔ Senha copiada!' : 'Copiar senha'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setTempPassword('')}>
              <Text style={styles.primaryBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48, gap: 16, maxWidth: 900, width: '100%', alignSelf: 'center' },
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
  errorBox: { backgroundColor: colors.red100, borderWidth: 1, borderColor: colors.red300, borderRadius: radius.md, padding: 11 },
  errorBoxText: { color: colors.red700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.md,
    borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card,
  },
  tabActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  tabText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
  actionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.coral300, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 13, backgroundColor: semantic.card,
  },
  actionBtnActive: { backgroundColor: colors.coral600, borderColor: colors.coral600 },
  actionBtnText: { color: colors.coral700, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  card: {
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 16, gap: 10, ...shadow.card,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: semantic.textSecondary, fontFamily: font.body, fontWeight: '700', fontSize: 11, marginBottom: 5 },
  input: {
    backgroundColor: semantic.card, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    padding: 11, fontSize: 13, color: semantic.textPrimary, fontFamily: font.body,
  },
  helpText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  divider: { height: 1, backgroundColor: semantic.border },
  emptyText: { color: semantic.textMuted, fontFamily: font.body, fontSize: 12, fontStyle: 'italic' },
  boothList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boothBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md,
    paddingVertical: 8, paddingHorizontal: 11, backgroundColor: colors.slate050,
  },
  boothBtnActive: { backgroundColor: colors.green700, borderColor: colors.green700 },
  boothBtnText: { color: colors.slate700, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.coral600, borderRadius: radius.md, paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  inviteBanner: { backgroundColor: colors.red100, borderColor: colors.red300 },
  inviteLabel: { color: colors.red700, fontFamily: font.body, fontWeight: '800', fontSize: 11 },
  inviteText: { color: colors.blue700, fontFamily: font.body, fontSize: 11.5, lineHeight: 16 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.blue700, backgroundColor: '#fff',
  },
  copyBtnText: { color: colors.blue700, fontFamily: font.body, fontWeight: '700', fontSize: 10 },
  filterBar: { gap: 10 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card },
  statusChipActive: { backgroundColor: colors.navy800, borderColor: colors.navy900 },
  statusChipText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11 },
  statusChipTextActive: { color: '#fff' },
  loadingBox: { padding: 40, alignItems: 'center' },
  userList: { gap: 10 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: semantic.card, borderRadius: radius.lg, borderWidth: 1, borderColor: semantic.border,
    padding: 13, ...shadow.card,
  },
  userCardSelected: { borderWidth: 2, borderColor: colors.coral600, backgroundColor: colors.coral050 },
  userAvatar: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontFamily: font.display, fontWeight: '800', fontSize: 15 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { color: semantic.textPrimary, fontFamily: font.body, fontWeight: '700', fontSize: 13.5 },
  userMeta: { color: semantic.textMuted, fontFamily: font.body, fontSize: 10.5 },
  selPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 5 },
  selPillText: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 8.5, letterSpacing: 0.5 },
  roleBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  roleBadgeText: { fontFamily: font.body, fontWeight: '800', fontSize: 9.5 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.md, borderWidth: 1, borderColor: semantic.border, backgroundColor: semantic.card },
  pageBtnText: { color: colors.slate600, fontFamily: font.body, fontWeight: '700', fontSize: 11.5 },
  pageInfo: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11 },
  editCard: { borderColor: colors.coral300 },
  cardSub: { color: semantic.textMuted, fontFamily: font.body, fontSize: 11, lineHeight: 16 },
  editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tempPwBox: { backgroundColor: colors.amber100, borderWidth: 1, borderColor: colors.amber700, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  tempPwText: { color: colors.amber900, fontFamily: font.display, fontWeight: '800', fontSize: 18, letterSpacing: 2 },
  fullCopyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: semantic.card, borderRadius: radius.lg, padding: 20, width: '100%', maxWidth: 440, gap: 10 },
  modalTitle: { color: semantic.textPrimary, fontFamily: font.display, fontWeight: '800', fontSize: 16 },
  modalDesc: { color: colors.amber800, fontFamily: font.body, fontSize: 11.5, lineHeight: 17 },
});