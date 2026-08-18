// src/screens/CheckIn.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import * as Location from 'expo-location'; // Captura GPS nativo [17]
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';

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
  const [checkingIn, setCheckingIn] = useState<string | null>(null); // Armazena o ID do plantão clicado
  const [error, setError] = useState('');

  const primaryColor = tenant?.primary_color || '#1c1c1e';

  // 1. Efeito Inicial: Busca os plantões cadastrados na nuvem para esta construtora [7]
  useEffect(() => {
    async function loadBooths() {
      try {
        const response = await api.get('/booths');
        setBooths(response.data);
      } catch (err: any) {
        setError('Falha ao carregar os plantões de vendas.');
      } finally {
        setLoading(false);
      }
    }

    loadBooths();
  }, []);

  // 2. Método de Check-in: Solicita GPS, captura localização e envia para a API [7, 8]
  const handleCheckIn = async (booth: Booth) => {
    try {
      setError('');
      setCheckingIn(booth.id);

      // A. Solicita permissão de GPS nativa para o celular/navegador [17]
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permissão de localização (GPS) é necessária para realizar o check-in.');
      }

      // B. Captura as coordenadas atuais de latitude/longitude [17]
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // C. Dispara a requisição de check-in para o backend [8]
      const response = await api.post('/presences/check-in', {
        boothId: booth.id,
        latitude,
        longitude,
        // ssid: "Abiatar_VistaPlaza_Main" // (Opcional - enviado se o app estivesse rodando nativo) [7]
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
        <Text style={styles.loadingText}>Carregando plantões...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenCode code="CR-01" />
      <Text style={styles.title}>Plantões Disponíveis</Text>
      <Text style={styles.subtitle}>Selecione o seu plantão de vendas atual para iniciar o turno [8]</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={booths}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.boothCard}>
            <View style={styles.boothInfo}>
              <Text style={styles.boothName}>{item.name}</Text>
              <Text style={styles.boothAddress}>{item.address}</Text>
              <Text style={styles.boothRadius}>Raio permitido: {item.gps_radius} metros</Text>
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
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: (Platform.OS === 'web' ? '100vh' : '100%') as any,
    backgroundColor: '#f5f5f7',
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    height: (Platform.OS === 'web' ? '100vh' : '100%') as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8e8e93',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 32,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  boothCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boothInfo: {
    flex: 1,
    paddingRight: 16,
  },
  boothName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  boothAddress: {
    fontSize: 14,
    color: '#3a3a3c',
    marginBottom: 8,
  },
  boothRadius: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '600',
  },
  checkInButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
});
