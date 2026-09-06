// App.tsx (na raiz do projeto)
import React, { useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import Login from './src/screens/Login';
import Dashboard from './src/screens/Dashboard';
import RegisterBroker from './src/screens/RegisterBroker'; // <-- IMPORTADO AQUI
import ProjectStatus from './src/screens/ProjectStatus';
import ChangePassword from './src/screens/ChangePassword';
import DevDashboard from './src/screens/DevDashboard';
import DashboardPreview from './src/screens/DashboardPreview';
import InstallAppButton from './src/components/InstallAppButton';

function AppContent({ inviteToken }: { inviteToken?: string }) {
  const { signed, loading, user } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login'); // <-- CONTROLE DE TELA

  // Se o aplicativo estiver buscando os dados salvos no celular, exibe tela de carregamento [15]
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E31C1C" />
      </View>
    );
  }

  if (inviteToken && !signed) {
    return <RegisterBroker inviteToken={inviteToken} onBackToLogin={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} />;
  }

  // Senha temporária exige troca antes de qualquer tela operacional.
  if (signed && user?.must_change_password) {
    return <ChangePassword />;
  }

  // Se o usuário estiver logado, exibe o Dashboard diretamente [15]
  if (signed) {
    return <Dashboard />;
  }

  // Se não estiver logado, alterna dinamicamente entre Login e Cadastro
  return currentScreen === 'login' ? (
    <Login onGoToRegister={() => setCurrentScreen('register')} />
  ) : (
    <RegisterBroker onBackToLogin={() => setCurrentScreen('login')} />
  );
}

export default function App() {
  const isStatusPage = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/status';
  const isDevPage = Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.pathname.replace(/\/$/, '') === '/dev' || window.location.search.includes('dev=true'));
  const isPreviewPage = Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.pathname.replace(/\/$/, '') === '/preview' || window.location.search.includes('preview=true'));
  const inviteMatch = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname.match(/^\/cadastro\/([^/]+)\/?$/) : null;
  const inviteToken = inviteMatch?.[1];

  if (isStatusPage) {
    return <ProjectStatus />;
  }

  if (isDevPage) {
    return <DevDashboard onBack={() => { window.location.href = '/'; }} />;
  }

  if (isPreviewPage) {
    return <DashboardPreview />;
  }

  return (
    <AuthProvider>
      <AppContent inviteToken={inviteToken} />
      <InstallAppButton />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
});
