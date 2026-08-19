import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';

interface BrokerProfile {
  id: string;
  name: string;
  nome_guerra: string;
  email: string;
  creci: string | null;
  status: string;
  manager_id: string | null;
  manager_nome_guerra: string | null;
  leads_paused: boolean;
  leads_pause_reason: string | null;
  carencia_ends_at: string | null;
}

interface Props {
  brokerId: string | null;
  isDirector: boolean;
  managers: Array<{ id: string; nome_guerra: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}

export default function BrokerManagementPanel({ brokerId, isDirector, managers, onClose, onSaved }: Props) {
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [reason, setReason] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = async () => {
    if (!brokerId) return;
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/users/${brokerId}/management-profile`);
      setProfile(response.data);
      setNomeGuerra(response.data.nome_guerra || '');
      setSelectedManagerId(response.data.manager_id || '');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível carregar o perfil do Corretor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProfile(); }, [brokerId]);

  const updateProfile = async () => {
    if (!profile) return;
    try {
      setSaving(true); setError('');
      await api.patch(`/users/${profile.id}/management-profile`, { nomeGuerra });
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível atualizar o Corretor.');
    } finally { setSaving(false); }
  };

  const setPause = async (paused: boolean) => {
    if (!profile || reason.trim().length < 3) {
      setError('Informe um motivo com pelo menos 3 caracteres.');
      return;
    }
    try {
      setSaving(true); setError('');
      await api.patch(`/users/${profile.id}/${paused ? 'leads-pause' : 'leads-resume'}`, { reason });
      setReason('');
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível alterar a situação de leads.');
    } finally { setSaving(false); }
  };

  const removeBroker = async () => {
    if (!profile || reason.trim().length < 3) {
      setError('Informe o motivo da exclusão lógica.');
      return;
    }
    try {
      setSaving(true); setError('');
      await api.delete(`/users/${profile.id}`, { data: { reason } });
      onSaved(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível remover o Corretor.');
    } finally { setSaving(false); }
  };

  const transferBroker = async () => {
    if (!profile || !selectedManagerId) {
      setError('Selecione um Gerente ativo.');
      return;
    }
    try {
      setSaving(true); setError('');
      await api.patch(`/users/${profile.id}/transfer`, { managerId: selectedManagerId, reason: reason || 'Transferência administrativa' });
      await loadProfile();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível transferir o Corretor.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={!!brokerId} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ScreenCode code="GE-03" />
        <TouchableOpacity onPress={onClose}><Text style={styles.back}>← Voltar para GE-02</Text></TouchableOpacity>
        <Text style={styles.title}>Ficha do Corretor</Text>
        <Text style={styles.subtitle}>Gestão individual, operação e vínculo hierárquico</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading || !profile ? <ActivityIndicator size="large" color="#1c1c1e" /> : (
          <>
            <View style={styles.card}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.line}>Nome de guerra: {profile.nome_guerra}</Text>
              <Text style={styles.line}>E-mail: {profile.email}</Text>
              <Text style={styles.line}>CRECI: {profile.creci || 'Não informado'}</Text>
              <Text style={styles.line}>Gerente: {profile.manager_nome_guerra || 'Sem gerente'}</Text>
              <Text style={styles.line}>Status: {profile.status}</Text>
              <Text style={[styles.state, profile.leads_paused ? styles.danger : styles.success]}>
                {profile.leads_paused ? 'Leads pausados' : 'Elegível para leads, conforme presença'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Dados editáveis</Text>
              <Text style={styles.label}>Nome de guerra</Text>
              <Text style={styles.help}>Será convertido para MAIÚSCULAS e deve ser único no tenant.</Text>
              <TextInput style={styles.input} value={nomeGuerra} onChangeText={(v) => setNomeGuerra(v.toLocaleUpperCase('pt-BR'))} />
              <TouchableOpacity style={styles.primaryButton} onPress={updateProfile} disabled={saving}><Text style={styles.buttonText}>Salvar alteração</Text></TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Operação de leads</Text>
              <Text style={styles.label}>Motivo da ação</Text>
              <TextInput style={[styles.input, styles.multiline]} value={reason} onChangeText={setReason} multiline placeholder="Informe o motivo" />
              {profile.leads_paused ? (
                <TouchableOpacity style={styles.successButton} onPress={() => setPause(false)} disabled={saving}><Text style={styles.buttonText}>Retomar recebimento de leads</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.warningButton} onPress={() => setPause(true)} disabled={saving}><Text style={styles.buttonText}>Pausar recebimento de leads</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={styles.dangerButton} onPress={removeBroker} disabled={saving}><Text style={styles.buttonText}>Excluir Corretor da operação</Text></TouchableOpacity>
            </View>

            {isDirector && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Transferência hierárquica</Text>
                <Text style={styles.help}>Somente Gerentes ativos do mesmo tenant podem receber o Corretor.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {managers.map((manager) => (
                    <TouchableOpacity key={manager.id} style={[styles.managerButton, selectedManagerId === manager.id && styles.managerSelected]} onPress={() => setSelectedManagerId(manager.id)}>
                      <Text style={selectedManagerId === manager.id ? styles.selectedText : styles.managerText}>{manager.nome_guerra || manager.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.primaryButton} onPress={transferBroker} disabled={saving}><Text style={styles.buttonText}>Mover para Gerente selecionado</Text></TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 24, paddingBottom: 60 },
  back: { color: '#1d4ed8', fontWeight: '700', fontSize: 16, marginBottom: 20 },
  title: { color: '#111827', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#4b5563', fontSize: 14, marginBottom: 20 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  name: { color: '#111827', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  line: { color: '#374151', fontSize: 15, marginBottom: 5 },
  state: { fontWeight: '800', marginTop: 10 },
  success: { color: '#166534' },
  danger: { color: '#b91c1c' },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label: { color: '#1f2937', fontWeight: '700', marginBottom: 4 },
  help: { color: '#4b5563', fontSize: 12, marginBottom: 8 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 8, paddingHorizontal: 12, color: '#111827', backgroundColor: '#fff', marginBottom: 12 },
  multiline: { minHeight: 76, paddingTop: 10, textAlignVertical: 'top' },
  primaryButton: { minHeight: 46, backgroundColor: '#1d4ed8', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 8 },
  warningButton: { minHeight: 46, backgroundColor: '#b45309', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 8 },
  successButton: { minHeight: 46, backgroundColor: '#15803d', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 8 },
  dangerButton: { minHeight: 46, backgroundColor: '#b91c1c', borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  managerButton: { borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, marginRight: 8, marginBottom: 8 },
  managerSelected: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  managerText: { color: '#1e3a8a', fontWeight: '700' },
  selectedText: { color: '#fff', fontWeight: '800' },
});
