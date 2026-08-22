// src/screens/Inbox.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ScreenCode from '../components/ScreenCode';

interface MessageRecipient {
  id: string;
  message_id: string;
  read_at: string | null;
  message: {
    id: string;
    title: string;
    content: string;
    is_urgent: boolean;
    created_at: string;
    sender: {
      nome_guerra: string;
    };
  };
}

interface InboxProps {
  onBack: () => void;
}

export default function Inbox({ onBack }: InboxProps) {
  const { tenant } = useAuth();
  const [messages, setMessages] = useState<MessageRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Controle de Visualização do Modal de Mensagem Urgente
  const [selectedMessage, setSelectedMessage] = useState<MessageRecipient | null>(null);
  const [markingRead, setMarkingRead] = useState(false);

  const primaryColor = tenant?.primary_color || '#1c1c1e';

  // 1. Efeito Inicial: Busca os comunicados da Caixa de Entrada na nuvem
  const loadMessages = async () => {
    try {
      setError('');
      const response = await api.get('/messages/my-inbox');
      setMessages(response.data);
    } catch (err: any) {
      setError('Falha ao carregar a sua caixa de entrada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  // 2. Método para Confirmar a Leitura da Mensagem
  const handleMarkAsRead = async (msg: MessageRecipient) => {
    const targetMsgId = msg.message?.id || msg.message_id;
    try {
      setMarkingRead(true);
      await api.patch(`/messages/${targetMsgId}/read`);
      
      // Atualiza localmente o estado para mostrar lido imediatamente
      setMessages(prev => prev.map(item => 
        (item.message_id === msg.message_id || item.id === msg.id)
          ? { ...item, read_at: new Date().toISOString() } 
          : item
      ));
      
      setSelectedMessage(null); // Fecha o modal
    } catch (err: any) {
      alert(err.response?.data?.message || 'Falha ao confirmar leitura.');
    } finally {
      setMarkingRead(false);
    }
  };

  // 3. Método para Excluir a Mensagem da Caixa de Entrada (Soft-delete)
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}`);
      // Remove da lista do front-end imediatamente
      setMessages(prev => prev.filter(item => (item.message?.id !== msgId && item.message_id !== msgId)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Não é possível excluir mensagens urgentes sem lê-las primeiro.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Carregando mensagens...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenCode code="IN-01" />
      {/* Botão de Voltar para a Tela Anterior */}
      <TouchableOpacity style={styles.backHeader} onPress={onBack}>
        <Text style={[styles.backHeaderText, { color: primaryColor }]}>← Voltar ao Painel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Minhas Mensagens</Text>
      <Text style={styles.subtitle}>Acompanhe os comunicados e alertas oficiais</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id || item.message_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Sua caixa de entrada está limpa no momento.</Text>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          const isUrgent = !!item.message?.is_urgent;
          const senderName = item.message?.sender?.nome_guerra || 'Diretoria / Gestão';

          return (
            <TouchableOpacity 
              style={[
                styles.messageCard, 
                isUrgent && isUnread ? { borderColor: '#ff3b30', borderWidth: 2 } : null
              ]}
              onPress={() => setSelectedMessage(item)}
            >
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isUnread && <Text style={styles.unreadIcon}>!</Text>}
                  <Text style={styles.senderText}>De: {senderName}</Text>
                </View>
                <Text style={isUnread ? styles.unreadStatus : styles.readStatus}>{isUnread ? 'NÃO LIDA' : 'LIDA'}</Text>
                {isUrgent && <Text style={styles.urgentBadge}>URGENTE</Text>}
              </View>

              <Text style={styles.messageTitle}>{item.message?.title || 'Sem título'}</Text>
              <Text style={styles.messageSnippet} numberOfLines={2}>{item.message?.content || ''}</Text>
              
              <View style={styles.cardFooter}>
                <Text style={styles.dateText}>
                  {item.message?.created_at ? new Date(item.message.created_at).toLocaleDateString('pt-BR') : ''}
                </Text>
                <TouchableOpacity onPress={() => handleDeleteMessage(item.message?.id || item.message_id)}>
                  <Text style={styles.deleteText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* MODAL PARA LEITURA COMPLETA DE MENSAGENS URGENTES/NORMAIS */}
      <Modal
        visible={selectedMessage !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalSender}>Remetente: {selectedMessage?.message?.sender?.nome_guerra || 'Diretoria / Gestão'}</Text>
            <Text style={styles.modalTitle}>{selectedMessage?.message?.title || ''}</Text>
            <Text style={styles.modalContent}>{selectedMessage?.message?.content || ''}</Text>

            {selectedMessage?.message?.is_urgent && !selectedMessage.read_at ? (
              // Se for urgente e não lida, exige o clique no botão de leitura
              <TouchableOpacity 
                style={[styles.readButton, { backgroundColor: primaryColor }]}
                onPress={() => handleMarkAsRead(selectedMessage)}
                disabled={markingRead}
              >
                {markingRead ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.readButtonText}>Confirmar Leitura Obrigatória</Text>
                )}
              </TouchableOpacity>
            ) : (
              // Mensagens normais ou já lidas fecham com botão simples
              <TouchableOpacity 
                style={[styles.closeButton, { borderColor: primaryColor }]}
                onPress={() => {
                  if (selectedMessage) {
                    handleMarkAsRead(selectedMessage); // Marca como lido silenciosamente ao fechar
                  }
                  setSelectedMessage(null);
                }}
              >
                <Text style={[styles.closeButtonText, { color: primaryColor }]}>Fechar Mensagem</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#f5f5f7',
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8e8e93',
  },
  backHeader: {
    marginTop: 40,
    marginBottom: 20,
  },
  backHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 4,
    textAlign: 'center',
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
  messageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unreadIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  unreadStatus: {
    color: '#ff3b30',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 'auto',
    marginRight: 8,
  },
  readStatus: {
    color: '#34c759',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 'auto',
    marginRight: 8,
  },
  senderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8e8e93',
  },
  urgentBadge: {
    backgroundColor: '#ff3b30',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 6,
  },
  messageSnippet: {
    fontSize: 14,
    color: '#3a3a3c',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#8e8e93',
  },
  deleteText: {
    color: '#ff3b30',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 16,
  },
  modalContent: {
    fontSize: 15,
    color: '#3a3a3c',
    lineHeight: 22,
    marginBottom: 24,
  },
  readButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  closeButton: {
    height: 48,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});
