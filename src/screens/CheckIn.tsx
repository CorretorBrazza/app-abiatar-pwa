// src/screens/CheckIn.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location'; // Captura GPS nativo
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Booth {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  gps_radius: number;
}

interface CheckInProps {
  onCheckInSuccess: (presence: any) => void;
}

export default function CheckIn({ onCheckInSuccess }: CheckInProps) {
  const { tenant } = useAuth();
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [error, setError] = useState('');

  const primaryColor = tenant?.primary_color || '#1c1c1e';
  const showTestDiagnostics = process.env.EXPO_PUBLIC_TEST_MODE !== 'false';

  // 1. Efeito Inicial: Busca os plantões cadastrados na nuvem para esta construtora
  useEffect(() => {
    async function loadBooths() {
      try {
        const response = await api.get('/booths');
        setBooths(Array.isArray(response.data) ? response.data : []);
      } catch (err: any) {
        setError('Falha ao carregar os plantões de vendas.');
      } finally {
        setLoading(false);
      }
    }

    loadBooths();
  }, []);

  // 2. Método de Check-in: Solicita GPS, captura localização e envia para a API
  const handleCheckIn = async (booth: Booth) => {
    try {
      setError('');
      setCheckingIn(booth.id);

      // A. Solicita permissão de GPS nativa para o celular/navegador
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permissão de localização (GPS) é necessária para realizar o check-in.');
      }

      // B. Captura as coordenadas atuais de latitude/longitude
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // C. Dispara a requisição de check-in para o backend
      const response = await api.post('/presences/check-in', {
        boothId: booth.id,
        latitude,
        longitude,
      });

      // D. Notifica o componente pai sobre o sucesso do check-in
      onCheckInSuccess(response.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Falha ao realizar check-in.';
      setError(msg);
    } finally {
      setCheckingIn(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Carregando plantões disponíveis...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>Plantões Disponíveis para Check-in</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {booths.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Nenhum plantão ativo disponível para check-in no momento.</Text>
        </View>
      ) : (
        booths.map((item) => (
          <View key={item.id} style={styles.boothCard}>
            <View style={styles.boothInfo}>
              <Text style={styles.boothName}>{item.name}</Text>
              <Text style={styles.boothAddress}>{item.address}</Text>
              {showTestDiagnostics && <Text style={styles.boothRadius}>[Raio permitido: {item.gps_radius}m]</Text>}
            </View>

            <TouchableOpacity
              style={[styles.checkInButton, { backgroundColor: primaryColor }]}
              onPress={() => handleCheckIn(item)}
              disabled={checkingIn !== null}
            >
              {checkingIn === item.id ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Fazer Check-in</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginBottom: 8,
  },
  centerContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8e8e93',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  boothCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boothInfo: {
    flex: 1,
    paddingRight: 12,
  },
  boothName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 2,
  },
  boothAddress: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 4,
  },
  boothRadius: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  checkInButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
  },
});
