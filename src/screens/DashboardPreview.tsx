// src/screens/DashboardPreview.tsx
// Preview visual (sem backend) de todas as variantes do Dashboard por cargo.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import IconButton, { APP_ICONS } from '../components/IconButton';
import PushSetupButton from '../components/PushSetupButton';
import BrokerMaterials from '../components/BrokerMaterials';

type RoleKey =
  | 'diretor'
  | 'gerente'
  | 'rh'
  | 'corretor'
  | 'corretor_ativo'
  | 'corretor_congelado'
  | 'recepcao';

const ROLES: Array<{ key: RoleKey; label: string }> = [
  { key: 'diretor', label: 'Diretoria' },
  { key: 'gerente', label: 'Gerência' },
  { key: 'rh', label: 'RH' },
  { key: 'corretor', label: 'Corretor' },
  { key: 'corretor_ativo', label: 'Corretor Ativo' },
  { key: 'corretor_congelado', label: 'Confirmação Presença' },
  { key: 'recepcao', label: 'Recepção' },
];

const PRIMARY = '#e53924';

const previewAlert = (msg: string) => {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(msg);
  }
};

const noop = () => previewAlert('Ação disponível apenas com o backend conectado.');

export default function DashboardPreview() {
  const [role, setRole] = useState<RoleKey>('diretor');
  return (
    <View style={{ flex: 1 }}>
      <DashboardPreviewSelector current={role} onChange={setRole} />
      <DashboardPreviewInner role={role} />
    </View>
  );
}

function DashboardPreviewInner({ role }: { role: RoleKey }) {
  const [unreadCount] = useState(3);
  const [brokerView, setBrokerView] = useState<'main' | 'check_in' | 'plantoes'>('main');
  const primaryColor = PRIMARY;

  const materialsUrl = 'https://linktr.ee/Abiatarimoveisconstrutora?utm_source=linktree_admin_share';
  const handleOpenMaterials = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(materialsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    previewAlert('Abrindo materiais...');
  };

  const renderHeader = (roleLabel: string, tenant = 'ABIATAR') => (
    <View style={[styles.header, { backgroundColor: primaryColor }]}>
      <View style={styles.headerRow}>
        <Text style={styles.tenantName}>{tenant}</Text>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>{roleLabel}</Text>
        </View>
      </View>
    </View>
  );

  // ============ RECEPÇÃO (mock fiel do ReceptionPanel) ============
  if (role === 'recepcao') {
    return (
      <View style={styles.container}>
        {renderHeader('Recepção')}
        <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.receptionContent}>
          <Text style={styles.welcomeTitle}>Olá, RECEPÇÃO.</Text>
          <Text style={styles.welcomeSubtitle}>Selecione um plantão atribuído para acompanhar a operação.</Text>

          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <IconButton
              imageSource={APP_ICONS.mensagens}
              label="Mensagens / Inbox"
              badge={unreadCount}
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plantão Alphaville (31)</Text>
            <Text style={styles.muted}>Av. Dracena, 1285 - Alphaville, Barueri/SP</Text>
            <Text style={styles.onlineStatus}>ONLINE: CARLOS, MARIANA, JOSÉ</Text>
            <Text style={styles.refreshText}>Atualização em tempo real; consulta de segurança a cada 15 segundos.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nenhum plantão atribuído</Text>
            <Text style={styles.muted}>
              A Diretoria ainda não vinculou esta recepção a um plantão. Quando houver uma atribuição,
              o acompanhamento operacional aparecerá aqui.
            </Text>
          </View>

          <View style={styles.composerPreview}>
            <Text style={styles.composerTitle}>Enviar Comunicado Operacional</Text>
            <Text style={styles.muted}>Dispara alerta instantâneo (Push) para os corretores online do plantão selecionado.</Text>
            <TouchableOpacity style={styles.composerBtn} onPress={noop}>
              <Text style={styles.composerBtnText}>Testar Comunicado (Preview)</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
            <IconButton
              imageSource={APP_ICONS.sair}
              label="Encerrar Sessão"
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ============ CORRETOR CONGELADO (confirmação de presença) ============
  if (role === 'corretor_congelado') {
    return (
      <View style={styles.frozenContainer}>
        <Text style={styles.frozenTitle}>Você ainda está no plantão?</Text>
        <Text style={styles.frozenText}>A confirmação é obrigatória para manter sua presença e continuar elegível aos leads.</Text>
        <Text style={styles.frozenText}>Ao confirmar, sua localização será validada por GPS ou Wi-Fi, sem rastreamento contínuo.</Text>
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 18, justifyContent: 'center' }}>
          <IconButton
            name="check-circle"
            label="Sim, no plantão"
            size="large"
            borderColor={primaryColor}
            onPress={noop}
          />
          <IconButton
            name="log-out"
            label="Fazer checkout"
            size="large"
            borderColor={primaryColor}
            onPress={noop}
          />
        </View>
      </View>
    );
  }

  // ============ CORRETOR SEM PLANTÃO (check-in) ============
  if (role === 'corretor') {
    if (brokerView === 'plantoes') {
      return (
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: primaryColor }]}>
            <IconButton
              name="arrow-left"
              label="Voltar"
              size="small"
              borderColor="#ffffff"
              color="#ffffff"
              textColor="#ffffff"
              backgroundColor="transparent"
              onPress={() => setBrokerView('main')}
            />
            <Text style={styles.tenantName}>ABIATAR</Text>
            <Text style={styles.headerTitle}>Meus Plantões</Text>
            <Text style={styles.headerSubtitle}>Roletas da semana e elegibilidade por plantão</Text>
          </View>
          <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.brokerScrollContent}>
            <View style={styles.brokerPeriodsCard}>
              <Text style={styles.brokerPeriodsTitle}>Minhas Roletas da Semana e Elegibilidade</Text>
              <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>
                Contagem semanal (Segunda a Domingo) · Elegibilidade calculada por plantão
              </Text>
              <Text style={styles.muted}>Total de Roletas cumpridas na semana: <Text style={{ fontWeight: '800' }}>4</Text></Text>
              <Text style={styles.muted}>Roletas incompletas/invalidadas: 1</Text>

              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={[styles.muted, { fontWeight: '700', color: '#1c1c1e', marginBottom: 2 }]}>Status por Plantão de Vendas:</Text>
                <View style={{ backgroundColor: '#fdecea', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#f0b5ab' }}>
                  <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>Plantão Alphaville (31)</Text>
                  <Text style={{ fontSize: 13, color: '#c13a28', marginTop: 2 }}>Roletas cumpridas no plantão: <Text style={{ fontWeight: '700' }}>4</Text></Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <View style={{ backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700' }}>🟢 Sábado: Elegível</Text>
                    </View>
                    <View style={{ backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#b45309', fontSize: 11, fontWeight: '700' }}>🟡 Domingo: Faltam 2 (4/6)</Text>
                    </View>
                  </View>
                </View>
                <View style={{ backgroundColor: '#fdecea', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#f0b5ab' }}>
                  <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>Plantão Ibirapuera (19)</Text>
                  <Text style={{ fontSize: 13, color: '#c13a28', marginTop: 2 }}>Roletas cumpridas no plantão: <Text style={{ fontWeight: '700' }}>5</Text></Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <View style={{ backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700' }}>🟢 Sábado: Elegível</Text>
                    </View>
                    <View style={{ backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#15803d', fontSize: 11, fontWeight: '700' }}>🟢 Domingo: Elegível</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }

    if (brokerView === 'check_in') {
      return (
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: primaryColor }]}>
            <IconButton
              name="arrow-left"
              label="Voltar"
              size="small"
              borderColor="#ffffff"
              color="#ffffff"
              textColor="#ffffff"
              backgroundColor="transparent"
              onPress={() => setBrokerView('main')}
            />
            <Text style={styles.tenantName}>ABIATAR</Text>
            <Text style={styles.headerTitle}>Check-in no Plantão</Text>
            <Text style={styles.headerSubtitle}>Selecione o plantão ativo para iniciar o turno</Text>
          </View>
          <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.brokerScrollContent}>
            <Text style={styles.sectionHeading}>Plantões Disponíveis para Check-in</Text>

            <View style={styles.boothCard}>
              <View style={styles.boothInfo}>
                <View style={styles.badgePontual}>
                  <Text style={styles.badgePontualText}>🟢 CHECK-IN PONTUAL · SORTEIO ÀS 09:01</Text>
                </View>
                <Text style={styles.boothName}>Plantão Alphaville (31)</Text>
                <Text style={styles.boothAddress}>Av. Dracena, 1285 - Alphaville, Barueri/SP</Text>
              </View>
              <IconButton
                imageSource={APP_ICONS.checkIn}
                label="Fazer Check-in"
                size="medium"
                borderColor={primaryColor}
                onPress={noop}
              />
            </View>

            <View style={styles.boothCard}>
              <View style={styles.boothInfo}>
                <View style={styles.badgePosBarra}>
                  <Text style={styles.badgePosBarraText}>🟡 PÓS-BARRA ABERTO (ATÉ ÀS 09:30)</Text>
                </View>
                <Text style={styles.boothName}>Plantão Ibirapuera (19)</Text>
                <Text style={styles.boothAddress}>Av. Pedro Álvares Cabral, s/n - Ibirapuera, São Paulo/SP</Text>
              </View>
              <IconButton
                imageSource={APP_ICONS.checkIn}
                label="Entrar Pós-Barra"
                size="medium"
                borderColor={primaryColor}
                onPress={noop}
              />
            </View>

            <View style={styles.boothCard}>
              <View style={styles.boothInfo}>
                <View style={styles.badgeClosed}>
                  <Text style={styles.badgeClosedText}>🔒 CHECK-IN FECHADO</Text>
                </View>
                <Text style={styles.boothName}>Plantão Moema (07)</Text>
                <Text style={styles.boothAddress}>Av. Ibirapuera, 2907 - Moema, São Paulo/SP</Text>
              </View>
              <IconButton
                imageSource={APP_ICONS.checkIn}
                label="Check-in Fechado"
                size="medium"
                borderColor={primaryColor}
                onPress={noop}
                disabled
              />
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {renderHeader('Corretor')}
        <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.brokerScrollContent}>
          <Text style={styles.welcomeTitle}>Olá, CORRETOR!</Text>
          <Text style={styles.welcomeSubtitle}>Toque em Check-in para escolher o plantão e iniciar o turno.</Text>

          <View style={styles.iconGrid}>
            <IconButton
              imageSource={APP_ICONS.checkIn}
              label="Check-in e Plantões"
              size="large"
              borderColor={primaryColor}
              onPress={() => setBrokerView('check_in')}
            />
            <IconButton
              imageSource={APP_ICONS.meusPlantoes}
              label="Meus Plantões"
              size="large"
              borderColor={primaryColor}
              onPress={() => setBrokerView('plantoes')}
            />
            <IconButton
              imageSource={APP_ICONS.mensagens}
              label="Mensagens / Inbox"
              badge={unreadCount}
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
            <PushSetupButton primaryColor={primaryColor} size="large" />
            <IconButton
              imageSource={APP_ICONS.sair}
              label="Encerrar Sessão"
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
          </View>

          <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />
        </ScrollView>
      </View>
    );
  }

  // ============ CORRETOR ATIVO ============
  if (role === 'corretor_ativo') {
    return (
      <View style={styles.container}>
        {renderHeader('Corretor Ativo')}
        <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.brokerScrollContent}>
          <Text style={styles.welcomeTitle}>Olá, CORRETOR!</Text>
          <Text style={styles.welcomeSubtitle}>Você está ativo e em plantão de vendas.</Text>

          <View style={[styles.card, { backgroundColor: '#1c1c1e', borderColor: '#333', borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: '#facc15', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Roleta Oficial
              </Text>
              <View style={{ backgroundColor: '#15803d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>SORTEADO NA ROLETA</Text>
              </View>
            </View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginVertical: 4 }}>
              🎰 3º Lugar na Fila
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, marginVertical: 8, gap: 4 }}>
              <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                🕒 <Text style={{ fontWeight: '700', color: '#fff' }}>Check-in realizado às:</Text> 08:57
              </Text>
              <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                🎯 <Text style={{ fontWeight: '700', color: '#fff' }}>Horário do sorteio:</Text> 09:01
              </Text>
              <Text style={{ color: '#f0b5ab', fontSize: 12 }}>
                📌 <Text style={{ fontWeight: '700', color: '#fff' }}>Status:</Text> Aguarde ser anunciado na recepção
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informações do Plantão</Text>
            <Text style={styles.muted}>Status: 🟢 ONLINE (Apto a receber leads)</Text>
            <Text style={styles.muted}>Plantão: Plantão Alphaville (31)</Text>
            <Text style={styles.muted}>Entrada: 08:57</Text>
          </View>

          <View style={styles.brokerPeriodsCard}>
            <Text style={styles.brokerPeriodsTitle}>Validação da Roleta em Tempo Real</Text>
            <Text style={styles.muted}>Roletas acumuladas na semana: 4</Text>
            <Text style={styles.muted}>Tempo cumprido na Roleta: 122 min / 480 min</Text>
          </View>

          <View style={styles.iconGrid}>
            <IconButton
              name="log-out"
              label="Finalizar Turno"
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
            <IconButton
              imageSource={APP_ICONS.mensagens}
              label="Mensagens / Alertas"
              badge={unreadCount}
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
            <PushSetupButton primaryColor={primaryColor} size="large" />
            <IconButton
              imageSource={APP_ICONS.sair}
              label="Encerrar Sessão"
              size="large"
              borderColor={primaryColor}
              onPress={noop}
            />
          </View>

          <BrokerMaterials primaryColor={primaryColor} onOpenMaterials={handleOpenMaterials} />
        </ScrollView>
      </View>
    );
  }

  // ============ DIRETORIA / ADMIN ============
  const renderDiretoria = () => (
    <View style={styles.iconGrid}>
      <IconButton
        imageSource={APP_ICONS.administrarPlantoes}
        label="Administrar Plantões e Regras"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <IconButton
        imageSource={APP_ICONS.inteligenciaBi}
        label="Inteligência de Plantão (BI)"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <IconButton
        imageSource={APP_ICONS.gerenciarEquipes}
        label="Gerenciar Corretores / Equipe"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <IconButton
        imageSource={APP_ICONS.comunicacaoInstitucional}
        label="Comunicação Institucional"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <IconButton
        imageSource={APP_ICONS.gerenciarGerentesRecepcao}
        label="Gerenciar Gerentes e Recepção"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <IconButton
        imageSource={APP_ICONS.mensagens}
        label="Mensagens / Alertas"
        badge={unreadCount}
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
      <PushSetupButton primaryColor={primaryColor} size="large" />
      <IconButton
        imageSource={APP_ICONS.sair}
        label="Encerrar Sessão"
        size="large"
        borderColor={primaryColor}
        onPress={noop}
      />
    </View>
  );

  // ============ GERÊNCIA ============
  const renderGerencia = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Painel da Gerência</Text>
        <Text style={styles.muted}>Acompanhe a assiduidade da sua equipe, envie convites, aprove novos corretores e gerencie a distribuição da fila de leads.</Text>
      </View>
      <View style={styles.iconGrid}>
        <IconButton
          imageSource={APP_ICONS.gerenciarEquipes}
          label="Gestão da Minha Equipe"
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
        <IconButton
          imageSource={APP_ICONS.comunicacaoInstitucional}
          label="Mensagem à Equipe"
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
        <IconButton
          imageSource={APP_ICONS.mensagens}
          label="Mensagens da Equipe"
          badge={unreadCount}
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
        <PushSetupButton primaryColor={primaryColor} size="large" />
        <IconButton
          imageSource={APP_ICONS.sair}
          label="Encerrar Sessão"
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
      </View>
    </>
  );

  // ============ RH ============
  const renderRh = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Painel de Recursos Humanos (RH)</Text>
        <Text style={styles.muted}>Acompanhe a evolução de corretores em treinamento, estagiários e CRECI de todas as equipes. Realize upgrades, downgrades e renove prazos de vigência.</Text>
      </View>
      <View style={styles.iconGrid}>
        <IconButton
          imageSource={APP_ICONS.gerenciarEquipes}
          label="Carreiras e Estágios (RH)"
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
        <IconButton
          imageSource={APP_ICONS.mensagens}
          label="Mensagens / Alertas"
          badge={unreadCount}
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
        <PushSetupButton primaryColor={primaryColor} size="large" />
        <IconButton
          imageSource={APP_ICONS.sair}
          label="Encerrar Sessão"
          size="large"
          borderColor={primaryColor}
          onPress={noop}
        />
      </View>
    </>
  );

  const roleInfo =
    role === 'gerente'
      ? { label: 'Gerência', tag: 'Gerência', subtitle: 'Acompanhe sua equipe, os corretores e as comunicações do plantão.', body: renderGerencia() }
      : role === 'rh'
        ? { label: 'Recursos Humanos (RH)', tag: 'Recursos Humanos (RH)', subtitle: 'Painel de Recursos Humanos: Gestão de carreiras, acompanhamento de estágios e renovação de vigências.', body: renderRh() }
        : { label: 'Diretoria', tag: 'Diretoria', subtitle: 'Seja bem-vindo à sua área de trabalho administrativa.', body: renderDiretoria() };

  return (
    <View style={styles.container}>
      {renderHeader(roleInfo.tag)}
      <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardScrollContent}>
        <Text style={styles.welcomeTitle}>Olá, {roleInfo.label.toUpperCase()}!</Text>
        <Text style={styles.welcomeSubtitle}>{roleInfo.subtitle}</Text>
        {roleInfo.body}
      </ScrollView>
    </View>
  );
}

// Barra de seleção de cargo (sobreposta no topo)
export function DashboardPreviewSelector({ current, onChange }: { current: RoleKey; onChange: (r: RoleKey) => void }) {
  return (
    <View style={styles.selectorBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorContent}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.selectorChip, current === r.key && styles.selectorChipActive]}
            onPress={() => onChange(r.key)}
          >
            <Text style={[styles.selectorChipText, current === r.key && styles.selectorChipTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdecea' },
  selectorBar: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0b5ab',
  },
  selectorContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  selectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  selectorChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  selectorChipText: { color: '#fdecea', fontSize: 13, fontWeight: '700' },
  selectorChipTextActive: { color: '#7f1d1d', fontWeight: '800' },
  header: {
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#c13a28',
    fontSize: 13,
    marginTop: 3,
  },
  sectionHeading: {
    width: '100%',
    maxWidth: 520,
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  boothCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0b5ab',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boothInfo: { flex: 1, paddingRight: 12 },
  boothName: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 2 },
  boothAddress: { fontSize: 13, color: '#c13a28', marginBottom: 4 },
  badgePontual: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgePontualText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
  badgePosBarra: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde047',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgePosBarraText: { color: '#b45309', fontSize: 11, fontWeight: '800' },
  badgeClosed: {
    backgroundColor: '#f5d2cd',
    borderColor: '#f0b5ab',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeClosedText: { color: '#c13a28', fontSize: 11, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  tenantName: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  roleTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleTagText: { color: '#FFF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dashboardScroll: { flex: 1 },
  dashboardScrollContent: { flexGrow: 1, padding: 24, paddingBottom: 48, alignItems: 'center' },
  brokerScrollContent: { flexGrow: 1, padding: 24, paddingBottom: 64, alignItems: 'center' },
  receptionContent: { padding: 24, alignItems: 'center', paddingBottom: 48 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 4 },
  welcomeSubtitle: { fontSize: 16, color: '#c13a28', marginBottom: 32, textAlign: 'center' },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 16,
    width: '100%',
    maxWidth: 520,
    marginVertical: 14,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0b5ab',
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  muted: { color: '#c13a28', lineHeight: 20, marginBottom: 8 },
  onlineStatus: { color: '#248a3d', fontWeight: '800', marginTop: 12 },
  refreshText: { color: '#c13a28', fontSize: 11, marginTop: 8 },
  brokerPeriodsCard: { width: '100%', maxWidth: 520, backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0b5ab' },
  brokerPeriodsTitle: { color: '#1c1c1e', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  composerPreview: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0b5ab',
  },
  composerTitle: { fontSize: 15, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  composerBtn: {
    backgroundColor: '#e53924',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
  },
  composerBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  frozenContainer: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff7ed' },
  frozenTitle: { fontSize: 26, fontWeight: '800', color: '#9a3412', textAlign: 'center', marginVertical: 14 },
  frozenText: { maxWidth: 520, color: '#7c2d12', textAlign: 'center', lineHeight: 22, marginBottom: 10 },
});