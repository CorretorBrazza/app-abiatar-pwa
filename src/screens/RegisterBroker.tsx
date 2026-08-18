// src/screens/RegisterBroker.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import api from '../services/api';

interface RegisterBrokerProps {
  onBackToLogin: () => void;
  inviteToken?: string;
}

export default function RegisterBroker({ onBackToLogin, inviteToken }: RegisterBrokerProps) {
  const [token, setToken] = useState(inviteToken || '');
  const [invitedRole, setInvitedRole] = useState<'gerencia_level_2' | 'corretor_level_3' | null>(null);
  const [inviteManagerName, setInviteManagerName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creci, setCreci] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const resolveToken = inviteToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '');
    if (!resolveToken) {
      setInviteLoading(false);
      return;
    }
    setToken(resolveToken);
    api.get(`/users/onboarding-link/${resolveToken}`)
      .then((response) => {
        setInvitedRole(response.data.invited_role);
        setInviteManagerName(response.data.manager?.nome_guerra || '');
      })
      .catch((err) => setError(err.response?.data?.message || 'Convite inválido ou expirado.'))
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const handleRegister = async () => {
    if (!token || !invitedRole || !name || !nomeGuerra || !email || !password || (invitedRole === 'corretor_level_3' && !creci)) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);

      const response = await api.post(invitedRole === 'gerencia_level_2' ? '/users/register-manager' : '/users/register-broker', {
        token,
        name,
        nomeGuerra,
        email,
        passwordHash: password,
        ...(invitedRole === 'corretor_level_3' ? { creci } : {}),
      });

      setSuccessMessage(response.data.message);
      
      // Limpa os campos após o sucesso
      setToken('');
      setName('');
      setNomeGuerra('');
      setEmail('');
      setPassword('');
      setCreci('');
      setInvitedRole(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao realizar o cadastro.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (inviteLoading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#1c1c1e" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{invitedRole === 'gerencia_level_2' ? 'Cadastro de Gerente' : invitedRole === 'corretor_level_3' ? 'Cadastro de Corretor' : 'Convite de Acesso'}</Text>
        <Text style={styles.subtitle}>{invitedRole === 'gerencia_level_2' ? 'Seu convite foi destinado ao nível de Gerência.' : invitedRole === 'corretor_level_3' ? `Seu cadastro ficará vinculado ao Gerente ${inviteManagerName || 'responsável'}.` : 'Informe um convite válido para continuar.'}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Código de Convite *"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Nome Completo *"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Nome de Guerra (Único na Empresa) *"
          value={nomeGuerra}
          onChangeText={setNomeGuerra}
        />

        <TextInput
          style={styles.input}
          placeholder="Seu melhor e-mail *"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Crie sua senha *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {invitedRole === 'corretor_level_3' && <TextInput
          style={styles.input}
          placeholder="Seu CRECI profissional *"
          value={creci}
          onChangeText={setCreci}
          autoCapitalize="characters"
        />}

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
              <Text style={styles.buttonText}>{invitedRole === 'gerencia_level_2' ? 'Concluir Cadastro de Gerente' : 'Enviar Cadastro de Corretor'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
          <Text style={styles.backButtonText}>Já tenho conta? Voltar ao Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#f5f5f7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c1c1e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fafafc',
  },
  button: {
    height: 48,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  successText: {
    color: '#34c759',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
});
