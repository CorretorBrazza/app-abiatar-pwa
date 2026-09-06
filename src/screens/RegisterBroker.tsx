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
import IconButton from '../components/IconButton';

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

  // 1. Comprovante de Residência
  const [residenceDoc, setResidenceDoc] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);

  // 2. Documento de Identificação (RG ou CNH)
  const [idDocMode, setIdDocMode] = useState<'single' | 'split'>('single');
  const [idDocSingle, setIdDocSingle] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);
  const [idDocFront, setIdDocFront] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);
  const [idDocBack, setIdDocBack] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);

  // 3. Carteira do CRECI (Estágio ou Definitiva)
  const [creciDocMode, setCreciDocMode] = useState<'single' | 'split'>('single');
  const [creciDocSingle, setCreciDocSingle] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);
  const [creciDocFront, setCreciDocFront] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);
  const [creciDocBack, setCreciDocBack] = useState<{ filename: string; contentType: string; base64: string; sizeFormatted: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ message: string; managerName: string; stage: string; totalDocs?: number } | null>(null);

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

  const compressImageIfNeeded = (file: File): Promise<{ base64: string; contentType: string; sizeFormatted: string }> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        // PDF ou outro documento: lê direto
        const reader = new FileReader();
        reader.onload = () => {
          const full = (reader.result as string) || '';
          const base64 = full.includes(',') ? full.split(',')[1] : full;
          const sizeKb = Math.round(file.size / 1024);
          const sizeFormatted = file.size < 1024 * 1024 ? `${sizeKb} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
          resolve({ base64, contentType: file.type || 'application/pdf', sizeFormatted });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Imagem: redimensiona e comprime no canvas para ficar leve e rápida
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const image = new Image();
        image.onload = () => {
          const maxDimension = 1600;
          let width = image.width;
          let height = image.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(image, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const base64 = dataUrl.split(',')[1];
            const approxBytes = Math.round((base64.length * 3) / 4);
            const sizeKb = Math.round(approxBytes / 1024);
            const sizeFormatted = approxBytes < 1024 * 1024 ? `${sizeKb} KB` : `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`;
            resolve({ base64, contentType: 'image/jpeg', sizeFormatted });
          } else {
            const full = (readerEvent.target?.result as string) || '';
            const base64 = full.includes(',') ? full.split(',')[1] : full;
            resolve({ base64, contentType: file.type, sizeFormatted: `${Math.round(file.size / 1024)} KB` });
          }
        };
        image.src = (readerEvent.target?.result as string) || '';
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSlotUpload = async (
    e: any,
    setter: (doc: { filename: string; contentType: string; base64: string; sizeFormatted: string } | null) => void,
  ) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError(`O arquivo ${file.name} ultrapassa o limite de 15MB.`);
      return;
    }

    try {
      setError('');
      const result = await compressImageIfNeeded(file);
      setter({
        filename: file.name,
        contentType: result.contentType,
        base64: result.base64,
        sizeFormatted: result.sizeFormatted,
      });
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
    }
  };

  const renderUploadSlot = (
    title: string,
    doc: { filename: string; contentType: string; base64: string; sizeFormatted: string } | null,
    onUpload: (e: any) => void,
    onRemove: () => void,
    hint?: string,
  ) => {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 2 }}>{title}</Text>
        {hint ? <Text style={{ fontSize: 11, color: '#c13a28', marginBottom: 6 }}>{hint}</Text> : null}

        {doc ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fdecea',
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#86efac',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#14532d' }} numberOfLines={1}>
                  {doc.filename}
                </Text>
                <Text style={{ fontSize: 11, color: '#16a34a' }}>{doc.sizeFormatted} · Pronto para envio</Text>
              </View>
            </View>
            <IconButton
              name="trash-2"
              label="Remover"
              size="small"
              borderColor="#ef4444"
              color="#ef4444"
              textColor="#ef4444"
              onPress={onRemove}
            />
          </View>
        ) : (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 14px',
              backgroundColor: '#fdecea',
              border: '1.5px dashed #f0b5ab',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              color: '#334155',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <span>📎 Anexar Documento (PDF ou Foto)</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={onUpload}
            />
          </label>
        )}
      </View>
    );
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

    // 1. Validação de Comprovante de Residência
    if (!residenceDoc) {
      setError('Por favor, anexe o seu Comprovante de Residência.');
      return;
    }

    // 2. Validação de Documento de Identificação (RG / CNH)
    if (idDocMode === 'single' && !idDocSingle) {
      setError('Por favor, anexe o seu Documento de Identificação (RG ou CNH).');
      return;
    }
    if (idDocMode === 'split' && (!idDocFront || !idDocBack)) {
      setError('Por favor, anexe a Foto da Frente e a Foto do Verso do seu documento de identificação.');
      return;
    }

    // 3. Validação de Carteira CRECI (quando não for treinamento)
    if (brokerStage !== 'treinamento') {
      if (creciDocMode === 'single' && !creciDocSingle) {
        setError(brokerStage === 'estagiario' ? 'Por favor, anexe a sua Carteira de Estágio CRECI.' : 'Por favor, anexe a sua Carteira CRECI Definitiva.');
        return;
      }
      if (creciDocMode === 'split' && (!creciDocFront || !creciDocBack)) {
        setError('Por favor, anexe a Foto da Frente e a Foto do Verso da sua Carteira CRECI.');
        return;
      }
    }

    // Montagem do payload de documentos estruturados
    const compiledDocs: Array<{ filename: string; contentType: string; base64: string }> = [];

    // Comprovante
    compiledDocs.push({
      filename: `Comprovante_Residencia_${residenceDoc.filename}`,
      contentType: residenceDoc.contentType,
      base64: residenceDoc.base64,
    });

    // Identificação
    if (idDocMode === 'single' && idDocSingle) {
      compiledDocs.push({
        filename: `Doc_Identificacao_${idDocSingle.filename}`,
        contentType: idDocSingle.contentType,
        base64: idDocSingle.base64,
      });
    } else if (idDocMode === 'split') {
      if (idDocFront) {
        compiledDocs.push({
          filename: `Doc_Identificacao_Frente_${idDocFront.filename}`,
          contentType: idDocFront.contentType,
          base64: idDocFront.base64,
        });
      }
      if (idDocBack) {
        compiledDocs.push({
          filename: `Doc_Identificacao_Verso_${idDocBack.filename}`,
          contentType: idDocBack.contentType,
          base64: idDocBack.base64,
        });
      }
    }

    // CRECI
    if (brokerStage !== 'treinamento') {
      if (creciDocMode === 'single' && creciDocSingle) {
        compiledDocs.push({
          filename: `Carteira_CRECI_${creciDocSingle.filename}`,
          contentType: creciDocSingle.contentType,
          base64: creciDocSingle.base64,
        });
      } else if (creciDocMode === 'split') {
        if (creciDocFront) {
          compiledDocs.push({
            filename: `Carteira_CRECI_Frente_${creciDocFront.filename}`,
            contentType: creciDocFront.contentType,
            base64: creciDocFront.base64,
          });
        }
        if (creciDocBack) {
          compiledDocs.push({
            filename: `Carteira_CRECI_Verso_${creciDocBack.filename}`,
            contentType: creciDocBack.contentType,
            base64: creciDocBack.base64,
          });
        }
      }
    }

    if (compiledDocs.length < 2) {
      setError('É obrigatório anexar no mínimo 2 arquivos de documentos (Comprovante de Residência e Documento de Identificação).');
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
        documents: compiledDocs,
      };

      const response = await api.post('/users/register-broker', payload);
      const chosenManager = managers.find((m) => m.id === selectedManagerId);
      const managerLabel = chosenManager ? (chosenManager.nome_guerra || chosenManager.name) : 'Gerência';

      setSuccessInfo({
        message: response.data.message || 'Cadastro enviado com sucesso! Aguarde a validação do RH e aprovação da Gerência.',
        managerName: managerLabel,
        stage: brokerStage,
        totalDocs: compiledDocs.length,
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
            <Text style={styles.summaryValue}>{successInfo.totalDocs} arquivo(s) enviados</Text>

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

          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <IconButton
              name="arrow-left"
              label="Voltar para o Login"
              size="large"
              borderColor="#e53924"
              onPress={onBackToLogin}
            />
          </View>
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
              <View style={{ marginTop: 4 }}>
                {/* Dropdown limpo e único para seleção do Gerente */}
                <select
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: selectedManagerId ? '2px solid #18181b' : '1px solid #d4d4d8',
                    backgroundColor: selectedManagerId ? '#fdecea' : '#ffffff',
                    fontSize: '15px',
                    fontWeight: selectedManagerId ? '600' : '400',
                    color: selectedManagerId ? '#0f172a' : '#71717a',
                    cursor: 'pointer',
                    outline: 'none',
                    boxSizing: 'border-box',
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

        {/* 4. UPLOAD DE DOCUMENTOS OBRIGATÓRIOS SEPARADOS POR ÁREA */}
        {!isManagerInvite && (
          <View style={{ marginVertical: 14 }}>
            <Text style={styles.sectionHeader}>4. Documentos Obrigatórios para Triagem</Text>
            <Text style={styles.helpText}>
              Anexe os documentos nas áreas correspondentes abaixo. Seus arquivos serão enviados diretamente ao RH da construtora para validação.
            </Text>

            {/* ÁREA 1: COMPROVANTE DE RESIDÊNCIA */}
            <View style={styles.uploadCategoryBox}>
              {renderUploadSlot(
                '🏠 Comprovante de Residência *',
                residenceDoc,
                (e) => handleSlotUpload(e, setResidenceDoc),
                () => setResidenceDoc(null),
                'Conta recente de consumo (luz, água, gás, internet) ou declaração.'
              )}
            </View>

            {/* ÁREA 2: DOCUMENTO PESSOAL (RG OU CNH) */}
            <View style={styles.uploadCategoryBox}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                🪪 Documento de Identificação (RG ou CNH) *
              </Text>
              <Text style={{ fontSize: 11, color: '#c13a28', marginBottom: 8 }}>
                Escolha se prefere enviar um arquivo único (PDF/CNH) ou tirar fotos separadas da frente e do verso:
              </Text>

              {/* Toggle modo único vs frente e verso */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.uploadModeBtn, idDocMode === 'single' && styles.uploadModeBtnActive]}
                  onPress={() => setIdDocMode('single')}
                >
                  <Text style={idDocMode === 'single' ? styles.uploadModeTextActive : styles.uploadModeText}>
                    📄 Arquivo Único (PDF / CNH Aberta)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadModeBtn, idDocMode === 'split' && styles.uploadModeBtnActive]}
                  onPress={() => setIdDocMode('split')}
                >
                  <Text style={idDocMode === 'split' ? styles.uploadModeTextActive : styles.uploadModeText}>
                    📷 Frente e Verso (2 Fotos)
                  </Text>
                </TouchableOpacity>
              </View>

              {idDocMode === 'single' ? (
                renderUploadSlot(
                  'Arquivo Único do RG ou CNH *',
                  idDocSingle,
                  (e) => handleSlotUpload(e, setIdDocSingle),
                  () => setIdDocSingle(null),
                  'PDF com frente e verso ou foto da CNH aberta.'
                )
              ) : (
                <View style={{ gap: 4 }}>
                  {renderUploadSlot(
                    'Foto da Frente (RG/CNH) *',
                    idDocFront,
                    (e) => handleSlotUpload(e, setIdDocFront),
                    () => setIdDocFront(null),
                    'Foto nítida da parte frontal do documento.'
                  )}
                  {renderUploadSlot(
                    'Foto do Verso (RG/CNH) *',
                    idDocBack,
                    (e) => handleSlotUpload(e, setIdDocBack),
                    () => setIdDocBack(null),
                    'Foto nítida do verso do documento.'
                  )}
                </View>
              )}
            </View>

            {/* ÁREA 3: CARTEIRA CRECI (APENAS ESTAGIÁRIO OU CORRETOR CRECI) */}
            {brokerStage !== 'treinamento' && (
              <View style={styles.uploadCategoryBox}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                  {brokerStage === 'estagiario' ? '📑 Carteira de Estágio CRECI *' : '📑 Carteira CRECI Definitiva *'}
                </Text>
                <Text style={{ fontSize: 11, color: '#c13a28', marginBottom: 8 }}>
                  Envie o documento em PDF/Digital ou as fotos da frente e verso da sua carteira profissional:
                </Text>

                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[styles.uploadModeBtn, creciDocMode === 'single' && styles.uploadModeBtnActive]}
                    onPress={() => setCreciDocMode('single')}
                  >
                    <Text style={creciDocMode === 'single' ? styles.uploadModeTextActive : styles.uploadModeText}>
                      📄 Arquivo Único (PDF / Carteira Digital)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.uploadModeBtn, creciDocMode === 'split' && styles.uploadModeBtnActive]}
                    onPress={() => setCreciDocMode('split')}
                  >
                    <Text style={creciDocMode === 'split' ? styles.uploadModeTextActive : styles.uploadModeText}>
                      📷 Frente e Verso (2 Fotos)
                    </Text>
                  </TouchableOpacity>
                </View>

                {creciDocMode === 'single' ? (
                  renderUploadSlot(
                    'Arquivo Único da Carteira CRECI *',
                    creciDocSingle,
                    (e) => handleSlotUpload(e, setCreciDocSingle),
                    () => setCreciDocSingle(null),
                    'PDF da certidão/carteira digital ou foto completa.'
                  )
                ) : (
                  <View style={{ gap: 4 }}>
                    {renderUploadSlot(
                      'Foto da Frente da Carteira CRECI *',
                      creciDocFront,
                      (e) => handleSlotUpload(e, setCreciDocFront),
                      () => setCreciDocFront(null),
                      'Foto nítida da frente da carteira.'
                    )}
                    {renderUploadSlot(
                      'Foto do Verso da Carteira CRECI *',
                      creciDocBack,
                      (e) => handleSlotUpload(e, setCreciDocBack),
                      () => setCreciDocBack(null),
                      'Foto nítida do verso da carteira.'
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* BOTÃO DE SUBMIT */}
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <IconButton
            name="send"
            label={isManagerInvite ? 'Concluir Cadastro de Gerente' : 'Enviar cadastro'}
            size="large"
            borderColor="#e53924"
            onPress={handleRegister}
            disabled={loading}
            loading={loading}
          />
        </View>

        {/* TOGGLE PARA QUEM TEM CONVITE / NÃO TEM CONVITE */}
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <IconButton
            name={hasInviteToken ? "users" : "key"}
            label={hasInviteToken ? 'Escolher gerente manualmente' : 'Tenho código de convite'}
            size="small"
            borderColor="#e53924"
            onPress={() => {
              setHasInviteToken(!hasInviteToken);
              setError('');
            }}
          />
        </View>

        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <IconButton
            name="arrow-left"
            label="Já possui uma conta? Voltar ao Login"
            size="medium"
            borderColor="#e53924"
            onPress={onBackToLogin}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#fdecea',
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
    color: '#c13a28',
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
    borderBottomColor: '#f0b5ab',
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
    backgroundColor: '#fdecea',
    borderWidth: 1.5,
    borderColor: '#f0b5ab',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  stageCardSelected: {
    borderColor: '#007aff',
    backgroundColor: '#fdecea',
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
    color: '#c13a28',
    textAlign: 'center',
  },
  managersGrid: {
    gap: 8,
  },
  managerCard: {
    backgroundColor: '#fdecea',
    borderWidth: 1.5,
    borderColor: '#f0b5ab',
    borderRadius: 8,
    padding: 12,
  },
  managerCardSelected: {
    borderColor: '#34c759',
    backgroundColor: '#fdecea',
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
    color: '#c13a28',
  },
  label: {
    color: '#1c1c1e',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    color: '#c13a28',
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#fdecea',
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
    backgroundColor: '#fdecea',
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
    color: '#c13a28',
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
    backgroundColor: '#fdecea',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#34c759',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#c13a28',
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
    color: '#c13a28',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  docNoticeBox: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f0b5ab',
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
  uploadCategoryBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0b5ab',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  uploadModeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadModeBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#fdecea',
  },
  uploadModeText: {
    fontSize: 11,
    color: '#c13a28',
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadModeTextActive: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
    textAlign: 'center',
  },
});

