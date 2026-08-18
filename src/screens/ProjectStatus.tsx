import React from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const stages = [
  { title: 'Fundação da plataforma', progress: 85, status: 'Estruturada', description: 'Ambientes digitais, identidade visual, acesso seguro e estrutura-base em consolidação.' },
  { title: 'Operação de plantões', progress: 65, status: 'Em consolidação', description: 'Fluxos de presença, localização e períodos avançam para a etapa de aceite operacional.' },
  { title: 'Comunicação operacional', progress: 60, status: 'Em evolução', description: 'Canais de alerta e mensagens formais seguem em validação e refinamento.' },
  { title: 'Gestão e indicadores', progress: 55, status: 'Em evolução', description: 'Painéis de operação, gestão, recepção e diretoria avançam em ciclos de validação.' },
  { title: 'Configuração operacional', progress: 70, status: 'Em consolidação', description: 'Regras por plantão, versionamento e critérios operacionais seguem em aperfeiçoamento.' },
  { title: 'Segurança e rastreabilidade', progress: 45, status: 'Em estruturação', description: 'Auditoria, proteção, documentação e critérios de aceite compõem o próximo ciclo.' },
  { title: 'Integrações e expansão', progress: 20, status: 'Planejada', description: 'Sincronizações externas, camada jurídica pública e administração global estão previstas.' },
];

export default function ProjectStatus() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ACOMPANHAMENTO DO PROJETO</Text>
        <Text style={styles.title}>ABIATAR</Text>
        <Text style={styles.subtitle}>Plataforma digital para gestão inteligente de operações imobiliárias.</Text>
        <View style={styles.domainBadge}><Text style={styles.domainText}>bitimob.com.br</Text></View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View><Text style={styles.cardLabel}>PRONTIDÃO INSTITUCIONAL</Text><Text style={styles.percent}>55%</Text></View>
          <View style={styles.statusPill}><View style={styles.statusDot} />        <Text style={styles.statusPillText}>Em consolidação</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: '55%' }]} /></View>
        <Text style={styles.heroText}>O projeto está em fase intermediária-avançada de consolidação. Os principais fluxos já foram estruturados, enquanto validações, refinamentos, documentação e preparação para escala continuam em andamento.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Infraestrutura preparada</Text>
        <Text style={styles.sectionIntro}>A infraestrutura essencial do projeto já foi adquirida e está disponível para a operação digital.</Text>
        <View style={styles.featureGrid}>
          {['Ambiente de hospedagem', 'Banco de dados protegido', 'Rotinas de backup', 'Camada de segurança', 'Comunicação e notificações', 'Monitoramento de disponibilidade'].map((item) => (
            <View key={item} style={styles.feature}><Text style={styles.featureMark}>✓</Text><Text style={styles.featureText}>{item}</Text></View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Evolução institucional por etapas</Text>
        {stages.map((stage) => (
          <View key={stage.title} style={styles.stageCard}>
            <View style={styles.stageHeader}><Text style={styles.stageTitle}>{stage.title}</Text><Text style={styles.stagePercent}>{stage.progress}%</Text></View>
            <View style={styles.stageTrack}><View style={[styles.stageFill, { width: `${stage.progress}%` }]} /></View>
            <View style={styles.stageMeta}><Text style={styles.stageStatus}>{stage.status}</Text><Text style={styles.stageDescription}>{stage.description}</Text></View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ambiente digital próprio</Text>
        <Text style={styles.paragraph}>O projeto utiliza o domínio próprio <Text style={styles.strong}>bitimob.com.br</Text> exclusivamente como ambiente de hospedagem e apresentação digital da plataforma.</Text>
        <Text style={styles.paragraph}>O domínio funciona como endereço institucional do ambiente tecnológico do projeto, sem representar divulgação de fornecedores ou de informações externas à solução.</Text>
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.cardLabel}>PRÓXIMOS MARCOS</Text>
        <Text style={styles.nextTitle}>Consolidação, integração e escala</Text>
        <Text style={styles.nextText}>As próximas etapas concentram-se no aperfeiçoamento operacional, na camada jurídica pública, nas integrações externas e na preparação para expansão.</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Última atualização: 18 de agosto de 2026</Text>
        <Text style={styles.footerText}>Página institucional de acompanhamento do projeto</Text>
        {Platform.OS === 'web' && <Pressable onPress={() => Linking.openURL('https://bitimob.com.br')}><Text style={styles.footerLink}>bitimob.com.br</Text></Pressable>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f6f8' },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 24, paddingBottom: 56 },
  header: { paddingVertical: 28, alignItems: 'center' },
  eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#111827', fontSize: 42, fontWeight: '900', letterSpacing: 5 },
  subtitle: { color: '#475569', fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 560, marginTop: 12 },
  domainBadge: { marginTop: 18, backgroundColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  domainText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  heroCard: { backgroundColor: '#111827', borderRadius: 20, padding: 26, marginBottom: 28, shadowColor: '#111827', shadowOpacity: .16, shadowRadius: 16, elevation: 5 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  cardLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  percent: { color: '#fff', fontSize: 56, fontWeight: '900', marginTop: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 8 },
  statusPillText: { color: '#d1fae5', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 10, backgroundColor: '#374151', borderRadius: 5, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 5 },
  heroText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, marginTop: 16 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#111827', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sectionIntro: { color: '#64748b', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  feature: { flexGrow: 1, flexBasis: '30%', minWidth: 220, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  featureMark: { color: '#16a34a', fontSize: 18, fontWeight: '900', marginRight: 10 },
  featureText: { color: '#334155', fontSize: 13, fontWeight: '700' },
  stageCard: { backgroundColor: '#fff', borderRadius: 14, padding: 17, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageTitle: { color: '#1e293b', fontSize: 15, fontWeight: '800', flex: 1 },
  stagePercent: { color: '#0f766e', fontSize: 14, fontWeight: '900' },
  stageTrack: { height: 7, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: 11 },
  stageFill: { height: '100%', backgroundColor: '#14b8a6', borderRadius: 4 },
  stageMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stageStatus: { color: '#0f766e', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  stageDescription: { color: '#64748b', fontSize: 12, flex: 1, lineHeight: 18 },
  paragraph: { color: '#475569', fontSize: 15, lineHeight: 24, marginTop: 8 },
  strong: { color: '#1e293b', fontWeight: '800' },
  nextCard: { backgroundColor: '#e0f2f1', borderRadius: 18, padding: 24, marginBottom: 28, borderWidth: 1, borderColor: '#99f6e4' },
  nextTitle: { color: '#134e4a', fontSize: 22, fontWeight: '800', marginTop: 8 },
  nextText: { color: '#115e59', fontSize: 14, lineHeight: 22, marginTop: 8 },
  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'center' },
  footerLink: { color: '#0f766e', fontWeight: '800', marginTop: 8 },
});
