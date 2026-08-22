// src/screens/RegisterBroker.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
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
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creci, setCreci] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const checkToken = async (rawToken: string) => {
    const clean = rawToken.trim();
    if (!clean || clean.length < 16) {
      setInvitedRole(null);
      setTokenValidated(false);
      setInviteManagerName('');
      return false;
    }

    try {
      setValidatingToken(true);
      setError('');
      const response = await api.get(`/users/onboarding-link/${clean}`);
      setInvitedRole(response.data.invited_role);
      setInviteManagerName(response.data.manager?.nome_guerra || response.data.manager?.name || '');
      setTokenValidated(true);
      return true;
    } catch (err: any) {
      setInvitedRole(null);
      setTokenValidated(false);
      setInviteManagerName('');
      setError(err.response?.data?.message || 'Código de convite inválido ou expirado.');
      return false;
    } finally {
      setValidatingToken(false);
    }
  };

  useEffect(() => {
    const resolveToken = inviteToken || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '');
    if (resolveToken) {
      setToken(resolveToken);
      void checkToken(resolveToken);
    }
  }, [inviteToken]);

  const handleTokenChange = (text: string) => {
    setToken(text);
    setError('');
    const clean = text.trim();
    if (clean.length >= 16) {
      void checkToken(clean);
    } else {
      setInvitedRole(null);
      setTokenValidated(false);
    }
  };

  const handleRegister = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setError('Por favor, informe o código de convite.');
      return;
    }

    let role = invitedRole;
    if (!role) {
      const isValid = await checkToken(cleanToken);
      if (!isValid) {
        setError('Código de convite inválido ou expirado.');
        return;
      }
      // Wait for state or fetch again if needed
      try {
        const response = await api.get(`/users/onboarding-link/${cleanToken}`);
        role = response.data.invited_role;
        setInvitedRole(role);
      } catch {
        setError('Não foi possível validar o convite.');
        return;
      }
    }

    if (!name.trim() || !nomeGuerra.trim() || !email.trim() || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (role === 'corretor_level_3' && !creci.trim()) {
      setError('O CRECI profissional é obrigatório para cadastro de Corretor.');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError('A senha deve conter entre 8 e 128 caracteres.');
      return;
    }
    if (nomeGuerra.trim().length < 2 || nomeGuerra.trim().length > 50) {
      setError('O nome de guerra deve conter entre 2 e 50 caracteres.');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);

      const endpoint = role === 'gerencia_level_2' ? '/users/register-manager' : '/users/register-broker';
      const payload = {
        token: cleanToken,
        name: name.trim(),
        nomeGuerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: email.trim().toLowerCase(),
        passwordHash: password,
        ...(role === 'corretor_level_3' ? { creci: creci.trim() } : {}),
      };

      const response = await api.post(endpoint, payload);

      setSuccessMessage(response.data.message || (role === 'gerencia_level_2' ? 'Cadastro de Gerente realizado com sucesso!' : 'Cadastro enviado com sucesso! Aguarde a aprovação do seu Gerente.'));
      
      // Limpa os campos após o sucesso
      setToken('');
      setName('');
      setNomeGuerra('');
      setEmail('');
      setPassword('');
      setCreci('');
      setInvitedRole(null);
      setTokenValidated(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao realizar o cadastro.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>
          {invitedRole === 'gerencia_level_2' ? 'Cadastro de Gerente' : invitedRole === 'corretor_level_3' ? 'Cadastro de Corretor' : 'Convite de Acesso'}
        </Text>
        <Text style={styles.subtitle}>
          {invitedRole === 'gerencia_level_2'
            ? 'Seu convite foi confirmado para o nível de Gerência.'
            : invitedRole === 'corretor_level_3'
            ? `Seu cadastro ficará vinculado ao Gerente ${inviteManagerName || 'responsável'}.`
            : 'Informe o código do seu convite para liberar o formulário.'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <Text style={styles.label}>Código de convite *</Text>
        <View style={styles.tokenRow}>
          <TextInput
            style={[styles.input, styles.tokenInput, tokenValidated && styles.inputSuccess]}
            placeholder="Cole seu código de convite *"
            value={token}
            onChangeText={handleTokenChange}
            autoCapitalize="none"
          />
          {validatingToken && <ActivityIndicator style={styles.tokenSpinner} color="#1c1c1e" />}
        </View>

        {tokenValidated && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              ✓ Convite validado: {invitedRole === 'gerencia_level_2' ? 'Gerência' : `Corretor (${inviteManagerName || 'Gerente responsável'})`}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Nome completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome Completo *"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Nome de guerra *</Text>
        <Text style={styles.helpText}>Será convertido para MAIÚSCULAS e deve ser único dentro da empresa.</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome de Guerra (Único na Empresa) *"
          value={nomeGuerra}
          onChangeText={(value) => setNomeGuerra(value.toLocaleUpperCase('pt-BR'))}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu melhor e-mail *"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Senha *</Text>
        <Text style={styles.helpText}>Use entre 8 e 128 caracteres. A senha diferencia maiúsculas e minúsculas.</Text>
        <TextInput
          style={styles.input}
          placeholder="Crie sua senha *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {invitedRole === 'corretor_level_3' && (
          <>
            <Text style={styles.label}>CRECI profissional *</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu CRECI profissional *"
              value={creci}
              onChangeText={setCreci}
              autoCapitalize="characters"
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, (!token.trim() || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !token.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {invitedRole === 'gerencia_level_2' ? 'Concluir Cadastro de Gerente' : 'Enviar Cadastro de Corretor'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
          <Text style={styles.backButtonText}>Já tenho conta? Voltar ao Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
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
  label: {
    color: '#1c1c1e',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    color: '#636366',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
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
  tokenRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  tokenInput: {
    paddingRight: 40,
  },
  tokenSpinner: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  inputSuccess: {
    borderColor: '#34c759',
    backgroundColor: '#f0fdf4',
  },
  badgeContainer: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  badgeText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700',
  },
  button: {
    height: 48,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
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
