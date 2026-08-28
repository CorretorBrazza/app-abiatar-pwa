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
} from 'react-native';
import api from '../services/api';

interface ManagerOption {
  id: string;
  name: string;
  nome_guerra: string;
}

interface RegisterBrokerProps {
  onBackToLogin: () => void;
  inviteToken?: string;
}

export default function RegisterBroker({ onBackToLogin, inviteToken }: RegisterBrokerProps) {
  // Modo de cadastro: sem convite (padrão) ou com convite
  const [hasInviteToken, setHasInviteToken] = useState(Boolean(inviteToken));
  const [token, setToken] = useState(inviteToken || '');
  const [invitedRole, setInvitedRole] = useState<'gerencia_level_2' | 'corretor_level_3' | null>(null);
  const [inviteManagerName, setInviteManagerName] = useState('');
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);

  // Lista de Gerentes Reais do Tenant
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Estágio do Corretor (3 Estágios)
  const [brokerStage, setBrokerStage] = useState<'treinamento' | 'estagiario' | 'corretor_creci'>('corretor_creci');

  // Campos do formulário
  const [name, setName] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creci, setCreci] = useState('');
  const [documents, setDocuments] = useState<Array<{ filename: string; contentType: string; base64: string; sizeFormatted: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ message: string; managerName: string; stage: string } | null>(null);

  const loadManagers = async () => {
    try {
      setLoadingManagers(true);
      const res = await api.get('/users/public-managers');
      if (res.data?.managers && Array.isArray(res.data.managers)) {
        setManagers(res.data.managers);
        // NÃO pré-seleciona nenhum gerente por padrão, obrigando o corretor a escolher
      }
    } catch (err) {
      console.error('Erro ao carregar gerentes públicos:', err);
    } finally {
      setLoadingManagers(false);
    }
  };

  const handleFileUpload = (e: any) => {
    const files: FileList = e.target.files;
    if (!files || files.length === 0) return;

    if (documents.length + files.length > 5) {
      setError('Você pode enviar no máximo 5 documentos.');
      return;
    }

    setError('');
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`O arquivo ${file.name} ultrapassa o limite de 10MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const fullBase64 = reader.result as string;
        const base64Data = fullBase64.includes(',') ? fullBase64.split(',')[1] : fullBase64;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const sizeFormatted = file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${sizeMb} MB`;
        setDocuments((prev) => {
          if (prev.length >= 5) return prev;
          return [
            ...prev,
            {
              filename: file.name,
              contentType: file.type || 'application/octet-stream',
              base64: base64Data,
              sizeFormatted,
            },
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Carrega a lista de gerentes reais na montagem
  useEffect(() => {
    void loadManagers();
  }, []);

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
      setHasInviteToken(true);
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
    if (!name.trim() || !nomeGuerra.trim() || !email.trim() || !password) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (nomeGuerra.trim().length < 2 || nomeGuerra.trim().length > 50) {
      setError('O nome de guerra deve conter entre 2 e 50 caracteres.');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError('A senha deve conter entre 8 e 128 caracteres.');
      return;
    }

    // Se for convite de Gerente
    if (hasInviteToken && invitedRole === 'gerencia_level_2') {
      const cleanToken = token.trim();
      if (!cleanToken) {
        setError('Por favor, informe o código de convite.');
        return;
      }

      try {
        setError('');
        setLoading(true);
        const payload = {
          token: cleanToken,
          name: name.trim(),
          nomeGuerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR'),
          email: email.trim().toLowerCase(),
          passwordHash: password,
        };

        const response = await api.post('/users/register-manager', payload);
        setSuccessInfo({
          message: response.data.message || 'Cadastro de Gerente concluído com sucesso!',
          managerName: 'Diretoria',
          stage: 'gerencia_level_2',
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Falha ao realizar cadastro de Gerente.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Se estiver usando convite de Corretor
    if (hasInviteToken) {
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
      }

      if (brokerStage !== 'treinamento' && !creci.trim()) {
        setError(brokerStage === 'estagiario' ? 'O CRECI de Estágio é obrigatório.' : 'O CRECI profissional é obrigatório.');
        return;
      }

      try {
        setError('');
        setLoading(true);
        const payload = {
          token: cleanToken,
          name: name.trim(),
          nomeGuerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR'),
          email: email.trim().toLowerCase(),
          passwordHash: password,
          brokerStage: brokerStage,
          ...(creci.trim() ? { creci: creci.trim() } : {}),
        };

        const response = await api.post('/users/register-broker', payload);
        setSuccessInfo({
          message: response.data.message || 'Cadastro realizado com sucesso!',
          managerName: inviteManagerName || 'Gerência',
          stage: brokerStage,
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Falha ao realizar cadastro.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Cadastro direto sem convite (com seleção do Gerente)
    if (!selectedManagerId) {
      setError('Por favor, selecione o Gerente da sua equipe.');
      return;
    }

    if (brokerStage !== 'treinamento' && !creci.trim()) {
      setError(brokerStage === 'estagiario' ? 'O CRECI de Estágio é obrigatório para estagiários.' : 'O CRECI profissional é obrigatório.');
      return;
    }

    if (documents.length === 0) {
      setError('Por favor, anexe ao menos um documento (RG/CNH, CRECI ou Comprovante de Residência) antes de enviar o cadastro.');
      return;
    }

    try {
      setError('');
      setLoading(true);

      const payload = {
        managerId: selectedManagerId,
        brokerStage: brokerStage,
        name: name.trim(),
        nomeGuerra: nomeGuerra.trim().toLocaleUpperCase('pt-BR'),
        email: email.trim().toLowerCase(),
        passwordHash: password,
        ...(creci.trim() ? { creci: creci.trim() } : {}),
        documents: documents.map((d) => ({
          filename: d.filename,
          contentType: d.contentType,
          base64: d.base64,
        })),
      };

      const response = await api.post('/users/register-broker', payload);
      const chosenManager = managers.find(m => m.id === selectedManagerId);
      const managerLabel = chosenManager ? (chosenManager.nome_guerra || chosenManager.name) : 'Gerência';

      setSuccessInfo({
        message: response.data.message || 'Cadastro enviado com sucesso! Aguarde a validação do RH e aprovação da Gerência.',
        managerName: managerLabel,
        stage: brokerStage,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao realizar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'gerencia_level_2': return '👑 Gerência Comercial (Diretoria)';
      case 'treinamento': return '🔵 Em Treinamento (Sem CRECI / Em formação)';
      case 'estagiario': return '🟡 Corretor Estagiário (CRECI Estágio)';
      case 'corretor_creci': default: return '🟢 Corretor com CRECI (Definitivo)';
    }
  };

  // Tela de Sucesso
  if (successInfo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.title}>Cadastro Enviado!</Text>
          <Text style={styles.successDesc}>
            Seu cadastro e documentos foram enviados para triagem do <Text style={{ fontWeight: 'bold' }}>Recursos Humanos (RH)</Text> e para a equipe do Gerente <Text style={{ fontWeight: 'bold' }}>{successInfo.managerName}</Text>.
          </Text>

          <View style={styles.successSummaryCard}>
            <Text style={styles.summaryLabel}>Nome de Guerra:</Text>
            <Text style={styles.summaryValue}>{nomeGuerra.toLocaleUpperCase('pt-BR')}</Text>

            <Text style={styles.summaryLabel}>E-mail:</Text>
            <Text style={styles.summaryValue}>{email.toLowerCase()}</Text>

            <Text style={styles.summaryLabel}>Estágio:</Text>
            <Text style={styles.summaryValue}>{getStageLabel(successInfo.stage)}</Text>

            <Text style={styles.summaryLabel}>Documentos Anexados:</Text>
            <Text style={styles.summaryValue}>{documents.length} arquivo(s)</Text>

            {creci.trim() ? (
              <>
                <Text style={styles.summaryLabel}>CRECI:</Text>
                <Text style={styles.summaryValue}>{creci.toUpperCase()}</Text>
              </>
            ) : null}
          </View>

          <Text style={styles.approvalNote}>
            O RH fará a conferência dos seus documentos para liberar sua conta para aprovação do Gerente.
          </Text>

          <TouchableOpacity style={styles.button} onPress={onBackToLogin}>
            <Text style={styles.buttonText}>Voltar para o Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const isManagerInvite = hasInviteToken && invitedRole === 'gerencia_level_2';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>
          {isManagerInvite ? 'Cadastro da Gerência' : 'Cadastre-se na ABIATAR'}
        </Text>
        <Text style={styles.subtitle}>
          {isManagerInvite
            ? 'Cadastro de liderança comercial vinculado à Diretoria'
            : 'Faça parte da equipe comercial da construtora'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* 1. SELEÇÃO DO ESTÁGIO DO CORRETOR (Apenas para Corretores) */}
        {!isManagerInvite && (
          <>
            <Text style={styles.sectionHeader}>1. Selecione o seu Estágio Profissional</Text>
            <View style={styles.stageContainer}>
              <TouchableOpacity
                style={[styles.stageCard, brokerStage === 'treinamento' && styles.stageCardSelected]}
                onPress={() => setBrokerStage('treinamento')}
              >
                <Text style={styles.stageTitle}>🔵 Treinamento</Text>
                <Text style={styles.stageSubtitle}>Sem CRECI / Curso</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stageCard, brokerStage === 'estagiario' && styles.stageCardSelected]}
                onPress={() => setBrokerStage('estagiario')}
              >
                <Text style={styles.stageTitle}>🟡 Estagiário</Text>
                <Text style={styles.stageSubtitle}>CRECI Estágio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stageCard, brokerStage === 'corretor_creci' && styles.stageCardSelected]}
                onPress={() => setBrokerStage('corretor_creci')}
              >
                <Text style={styles.stageTitle}>🟢 Corretor CRECI</Text>
                <Text style={styles.stageSubtitle}>CRECI Definitivo</Text>
              </TouchableOpacity>
            </View>

            {/* AVISO DE DOCUMENTOS ESPECÍFICOS POR ESTÁGIO */}
            <View style={styles.docNoticeBox}>
              <Text style={styles.docNoticeTitle}>📄 Documentos Obrigatórios para este estágio:</Text>
              <Text style={styles.docNoticeText}>
                {brokerStage === 'treinamento'
                  ? 'Separe já seus documentos pessoais (RG, CPF ou CNH) e um comprovante de residência atualizado.'
                  : brokerStage === 'estagiario'
                  ? 'Separe já sua carteira de estagiário CRECI e um comprovante de residência atualizado.'
                  : 'Separe já sua carteira CRECI definitiva e um comprovante de residência atualizado.'}
              </Text>
            </View>
          </>
        )}

        {/* 2. SELEÇÃO DO GERENTE (Apenas no cadastro direto sem token) */}
        {!hasInviteToken && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.sectionHeader}>2. Escolha o seu Gerente *</Text>
            {loadingManagers ? (
              <ActivityIndicator color="#1c1c1e" style={{ marginVertical: 12 }} />
            ) : managers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={styles.helpText}>Nenhum gerente encontrado no momento.</Text>
                <TouchableOpacity style={{ marginTop: 6 }} onPress={loadManagers}>
                  <Text style={{ color: '#007aff', fontWeight: 'bold', fontSize: 13 }}>🔄 Tentar carregar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {/* Dropdown nativo/web para seleção limpa */}
                <select
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: selectedManagerId ? '2px solid #000' : '1px solid #d4d4d8',
                    backgroundColor: selectedManagerId ? '#fafafa' : '#ffffff',
                    fontSize: '14px',
                    fontWeight: selectedManagerId ? '600' : '400',
                    color: selectedManagerId ? '#000000' : '#71717a',
                    cursor: 'pointer',
                    outline: 'none',
                    marginBottom: '6px',
                  }}
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                >
                  <option value="">-- Selecione o seu Gerente Responsável * --</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      Gerente {m.nome_guerra || m.name} ({m.name})
                    </option>
                  ))}
                </select>

                <View style={styles.managersGrid}>
                  {managers.map((m) => {
                    const isSelected = selectedManagerId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.managerCard, isSelected && styles.managerCardSelected]}
                        onPress={() => setSelectedManagerId(isSelected ? '' : m.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.managerIcon}>{isSelected ? '✓' : '👤'}</Text>
                          <View style={{ marginLeft: 8, flex: 1 }}>
                            <Text style={[styles.managerNomeGuerra, isSelected && { color: '#000' }]}>
                              Gerente {m.nome_guerra || m.name}
                            </Text>
                            <Text style={styles.managerFullName}>{m.name}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* MODO COM CÓDIGO DE CONVITE */}
        {hasInviteToken && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Código de Convite *</Text>
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
                  ✓ Convite validado: {invitedRole === 'gerencia_level_2' ? '👑 Gerência (Diretoria)' : `Corretor (${inviteManagerName || 'Gerente responsável'})`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 3. DADOS PESSOAIS E ACESSO */}
        <Text style={styles.sectionHeader}>{isManagerInvite ? 'Dados de Acesso da Gerência' : '3. Seus Dados de Acesso'}</Text>

        <Text style={styles.label}>Nome Completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: João da Silva"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Nome de Guerra *</Text>
        <Text style={styles.helpText}>Nome que será exibido nas escalas, relatórios e equipe.</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: SILVA"
          value={nomeGuerra}
          onChangeText={(value) => setNomeGuerra(value.toLocaleUpperCase('pt-BR'))}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>E-mail de Trabalho *</Text>
        <TextInput
          style={styles.input}
          placeholder="seuemail@exemplo.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Senha de Acesso *</Text>
        <Text style={styles.helpText}>Mínimo de 8 caracteres.</Text>
        <TextInput
          style={styles.input}
          placeholder="Crie sua senha segura *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {/* CAMPO CRECI (Apenas para Corretores) */}
        {!isManagerInvite && (
          <>
            <Text style={styles.label}>
              {brokerStage === 'treinamento'
                ? 'CRECI (Opcional - Em Formação)'
                : brokerStage === 'estagiario'
                ? 'Número do CRECI de Estágio *'
                : 'Número do CRECI Profissional *'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={brokerStage === 'treinamento' ? 'Deixe em branco ou informe se já tiver' : 'Ex: 123456-F'}
              value={creci}
              onChangeText={setCreci}
              autoCapitalize="characters"
            />
          </>
        )}

        {/* 4. UPLOAD DE DOCUMENTOS (MÁXIMO 5 DOCUMENTOS) */}
        {!isManagerInvite && (
          <View style={{ marginVertical: 14 }}>
            <Text style={styles.sectionHeader}>4. Envio de Documentos (Máx. 5 arquivos)</Text>
            <Text style={styles.helpText}>
              Envie fotos ou PDFs dos seus documentos para validação pelo RH (RG/CNH, Carteira CRECI e Comprovante de Residência).
            </Text>

            <View style={{ marginTop: 8 }}>
              {/* Botão de Anexo */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 18px',
                  backgroundColor: '#f4f4f5',
                  border: '1px dashed #71717a',
                  borderRadius: '8px',
                  cursor: documents.length >= 5 ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: '#18181b',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span>📎 {documents.length >= 5 ? 'Limite de 5 documentos atingido' : 'Escolher Arquivos (PDF, JPG, PNG)'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={documents.length >= 5}
                />
              </label>

              {/* Lista de Documentos Anexados */}
              {documents.length > 0 && (
                <View style={{ marginTop: 10, gap: 6 }}>
                  {documents.map((doc, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: '#f8fafc',
                        padding: 10,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, marginRight: 6 }}>📄</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>
                            {doc.filename}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748b' }}>{doc.sizeFormatted}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => removeDocument(idx)}>
                        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>✕ Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* BOTÃO DE SUBMIT */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isManagerInvite
                ? 'Concluir Cadastro de Gerente'
                : 'Enviar cadastro'}
            </Text>
          )}
        </TouchableOpacity>

        {/* TOGGLE PARA QUEM TEM CONVITE / NÃO TEM CONVITE */}
        <TouchableOpacity
          style={styles.toggleInviteButton}
          onPress={() => {
            setHasInviteToken(!hasInviteToken);
            setError('');
          }}
        >
          <Text style={styles.toggleInviteText}>
            {hasInviteToken ? '← Quero escolher o gerente manualmente' : 'Tenho um código de convite específico'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
          <Text style={styles.backButtonText}>Já possui uma conta? Voltar ao Login</Text>
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
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1c1e',
    marginTop: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
    paddingBottom: 4,
  },
  stageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  stageCard: {
    flex: 1,
    backgroundColor: '#fafafc',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  stageCardSelected: {
    borderColor: '#007aff',
    backgroundColor: '#f0f7ff',
  },
  stageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4,
    textAlign: 'center',
  },
  stageSubtitle: {
    fontSize: 10,
    color: '#8e8e93',
    textAlign: 'center',
  },
  managersGrid: {
    gap: 8,
  },
  managerCard: {
    backgroundColor: '#fafafc',
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 8,
    padding: 12,
  },
  managerCardSelected: {
    borderColor: '#34c759',
    backgroundColor: '#f0fdf4',
  },
  managerIcon: {
    fontSize: 18,
    color: '#34c759',
    fontWeight: 'bold',
  },
  managerNomeGuerra: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  managerFullName: {
    fontSize: 12,
    color: '#8e8e93',
  },
  label: {
    color: '#1c1c1e',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    color: '#8e8e93',
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
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
    top: 13,
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
    height: 50,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleInviteButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  toggleInviteText: {
    color: '#007aff',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  successIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  successDesc: {
    fontSize: 14,
    color: '#3c3c43',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  successSummaryCard: {
    backgroundColor: '#f5f5f7',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#34c759',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8e8e93',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '600',
    marginBottom: 6,
  },
  approvalNote: {
    fontSize: 12,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  docNoticeBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  docNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 2,
  },
  docNoticeText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 17,
  },
});

