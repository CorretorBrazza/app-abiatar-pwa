// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import api from '../services/api';
import { registerWebPushNotifications } from '../services/push';

// 1. Definição das Interfaces de Tipagem Estrita
interface User {
  id: string;
  name: string;
  nome_guerra: string;
  role: string;
  must_change_password?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  settings?: { features?: Record<string, boolean>; cards?: Record<string, Record<string, boolean>>; approval?: { allowed_roles?: string[]; grace_period_options?: number[] } };
  logo_url: string | null;
}

interface AuthContextData {
  signed: boolean;
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login(email: string, passwordHash: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // 2. Efeito Inicial: Recupera os dados salvos no celular ao abrir o aplicativo
  useEffect(() => {
    async function loadStorageData() {
      try {
        const [storagedToken, storagedUser, storagedTenant] = await Promise.all([
          AsyncStorage.getItem('@abiatar:token'),
          AsyncStorage.getItem('@abiatar:user'),
          AsyncStorage.getItem('@abiatar:tenant'),
        ]);

        if (storagedToken && storagedUser && storagedTenant) {
          // Injeta o token recuperado de forma padrão no cliente HTTP do Axios
          api.defaults.headers.common['Authorization'] = `Bearer ${storagedToken}`;
          
          setUser(JSON.parse(storagedUser));
          setTenant(JSON.parse(storagedTenant));
          void registerWebPushNotifications();
        }
      } catch (error) {
        console.error(
          '[AUTH - ERRO] Falha ao carregar dados do armazenamento:',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setLoading(false);
      }
    }

    loadStorageData();
  }, []);

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await logout();
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Não foi possível alterar a senha.'
        : 'Não foi possível alterar a senha.';
      throw new Error(errorMessage);
    }
  };

  // 3. Método de Login: Chama a API, valida credenciais e salva as cores de estilização do inquilino
  const login = async (email: string, passwordHash: string) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        passwordHash,
      });

      const { access_token, user: loggedUser, tenant: loggedTenant } = response.data;

      // Injeta o token nas próximas requisições do Axios automaticamente
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Salva de forma persistente no armazenamento do celular
      await Promise.all([
        AsyncStorage.setItem('@abiatar:token', access_token),
        AsyncStorage.setItem('@abiatar:user', JSON.stringify(loggedUser)),
        AsyncStorage.setItem('@abiatar:tenant', JSON.stringify(loggedTenant)),
      ]);

      setUser(loggedUser);
      setTenant(loggedTenant);
      void registerWebPushNotifications();
    } catch (error) {
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Falha na autenticação. Verifique suas credenciais.'
        : 'Falha na autenticação. Verifique suas credenciais.';
      throw new Error(errorMessage);
    }
  };

  // 4. Método de Logout: Limpa os dados e encerra a sessão de forma segura
  const logout = async () => {
    try {
      // Inativa o token de push deste dispositivo no backend para não receber notificações após desconectar
      try {
        const storedFcmToken = await AsyncStorage.getItem('@abiatar:fcm_token');
        if (storedFcmToken) {
          await api.post('/notifications/devices/deactivate', { token: storedFcmToken });
        }
      } catch (pushErr) {
        console.warn('[AUTH] Falha ao desativar token push no logout:', pushErr);
      }

      await AsyncStorage.multiRemove([
        '@abiatar:token',
        '@abiatar:user',
        '@abiatar:tenant',
        '@abiatar:fcm_token',
      ]);
      
      setUser(null);
      setTenant(null);
    } catch (error) {
      console.error(
        '[AUTH - ERRO] Falha ao limpar o armazenamento durante o logout:',
        error instanceof Error ? error.message : String(error),
      );
      setUser(null);
      setTenant(null);
    }
  };

  return (
    <AuthContext.Provider value={{ signed: !!user, user, tenant, loading, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// 5. Hook Personalizado para facilitar o acesso rápido aos dados de autenticação em qualquer tela
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
