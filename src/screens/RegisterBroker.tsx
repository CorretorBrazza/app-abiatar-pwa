// src/screens/RegisterBroker.tsx
import React, { useState } from 'react';
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
}

export default function RegisterBroker({ onBackToLogin }: RegisterBrokerProps) {
  const [token, setToken] = useState(''); // Token do link recebido pelo WhatsApp
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creci, setCreci] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async () => {
    if (!token || !name || !nomeGuerra || !email || !password || !creci) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);

      // Dispara o cadastro para a rota pública do nosso backend
      const response = await api.post('/users/register-broker', {
        token,
        name,
        nomeGuerra,
        email,
        passwordHash: password,
        creci,
      });

      setSuccessMessage(response.data.message);
      
      // Limpa os campos após o sucesso
      setToken('');
      setName('');
      setNomeGuerra('');
      setEmail('');
      setPassword('');
      setCreci('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao realizar o cadastro.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Cadastre-se no Sistema</Text>
        <Text style={styles.subtitle}>Insira o convite do gerente para iniciar</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Código de Convite (Token do Gerente) *"
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

        <TextInput
          style={styles.input}
          placeholder="Seu CRECI profissional *"
          value={creci}
          onChangeText={setCreci}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Enviar Cadastro</Text>
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
