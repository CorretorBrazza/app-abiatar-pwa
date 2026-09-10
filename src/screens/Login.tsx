// src/screens/Login.tsx
import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import IconButton from '../components/IconButton';
import api from '../services/api';

interface LoginProps {
  onGoToRegister: () => void; // <-- ADICIONADO ESTE PARÂMETRO
}

export default function Login({ onGoToRegister }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha ao logar.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      setForgotMessage('Informe seu e-mail cadastrado.');
      return;
    }
    try {
      setForgotLoading(true);
      setForgotMessage('');
      const res = await api.post('/auth/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setForgotMessage(res.data?.message || 'Senha temporária enviada para o seu e-mail.');
    } catch (err: any) {
      setForgotMessage(err.response?.data?.message || 'Não foi possível enviar a recuperação. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Image
          source={require('../../assets/abiatar-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Logo Abiatar"
        />
        <Text style={styles.title}>APP ABIATAR</Text>
        <Text style={styles.subtitle}>Acesse a sua conta</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Seu e-mail de trabalho"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Sua senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        {showForgot ? (
          <View style={styles.forgotBox}>
            <Text style={styles.forgotTitle}>🔄 Recuperar senha</Text>
            <Text style={styles.forgotSub}>
              Informe o e-mail cadastrado. Enviaremos uma senha temporária (válida por 30 minutos).
            </Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail cadastrado"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword} disabled={forgotLoading}>
              <Text style={styles.forgotButtonText}>{forgotLoading ? 'Enviando...' : 'Enviar senha temporária'}</Text>
            </TouchableOpacity>
            {forgotMessage ? <Text style={styles.forgotMessageStyle}>{forgotMessage}</Text> : null}
          </View>
        ) : (
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: -6, marginBottom: 4 }}
            onPress={() => { setShowForgot(true); setError(''); }}
          >
            <Text style={styles.forgotLink}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        )}

        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <IconButton
            name="log-in"
            label="Entrar no Sistema"
            size="large"
            borderColor="#e53924"
            onPress={handleLogin}
            disabled={loading}
            loading={loading}
          />
        </View>

        {/* LINK PARA IR PARA A TELA DE CADASTRO */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <IconButton
            name="user-plus"
            label="Cadastre-se aqui"
            size="medium"
            borderColor="#e53924"
            onPress={onGoToRegister}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  container: {
    flex: 1,
    height: (Platform.OS === 'web' ? '100vh' : '100%') as any,
    backgroundColor: '#fdecea',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logo: {
    width: '100%',
    height: 96,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#c13a28',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fdecea',
  },
  button: {
    height: 50,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#c13a28',
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
  forgotLink: {
    color: '#c13a28',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginBottom: 10,
  },
  forgotBox: {
    backgroundColor: '#fdecea',
    borderColor: '#f0b5ab',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  forgotTitle: {
    color: '#1c1c1e',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  forgotSub: {
    color: '#c13a28',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  forgotButton: {
    height: 44,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  forgotMessageStyle: {
    color: '#15803d',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
    fontWeight: '600',
  },
});
