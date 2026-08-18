// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

// 1. Interceptador de Requisições: Injeta o Token JWT Bearer automaticamente se existir
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@abiatar:token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error(
        '[API - ERRO] Falha ao recuperar o token do armazenamento local:',
        error instanceof Error ? error.message : String(error),
      );
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 2. Interceptador de Respostas: Desloga e redireciona automaticamente se o Token expirar (Erro 401)
// (Ignora a rota de login para evitar o loop de recarregamento infinito)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Verifica se a requisição que deu erro foi especificamente a de login
    const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');

    // Só limpa o token e força o recarregamento se o erro 401 NÃO vier da rota de login!
    if (error.response && error.response.status === 401 && !isLoginRequest) {
      try {
        await AsyncStorage.multiRemove([
          '@abiatar:token',
          '@abiatar:user',
          '@abiatar:tenant',
        ]);
        
        if (Platform.OS === 'web') {
          window.location.reload();
        }
      } catch (err) {
        console.error(
          '[API - ERRO] Falha ao limpar sessão expirada:',
          err instanceof Error ? err.message : String(err),
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
