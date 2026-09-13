// Camada de interface "Nova Identidade" (navy/coral) — paralela à clássica.
// Shell + roteamento por workspace (Blocos B/C aprovados). Os painéis de negócio
// existentes são reaproveitados até cada tela ser restilizada por completo.

import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  UserCheck,
} from 'lucide-react-native';
const FAVICON = require('../../assets/favicon.png');
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Inbox from '../screens/Inbox';
import ManagerPanel from '../screens/ManagerPanel';
import CheckIn from '../screens/CheckIn';
import NovaReception from './NovaReception';
import NovaCommandCenter from './NovaCommandCenter';
import NovaMinhaEquipe from './NovaMinhaEquipe';
import NovaVisaoRh from './NovaVisaoRh';
import NovaPerfisRh from './NovaPerfisRh';
import NovaOperacao from './NovaOperacao';
import NovaPessoas from './NovaPessoas';
import NovaPerformance from './NovaPerformance';
import NovaMensagens from './NovaMensagens';
import { colors, font, fonts, radius, semantic, shadow, statusTone } from './tokens';
import { useNovaFonts } from './fonts';
import {
  firstView,
  profileForRole,
  PROFILES,
  PROFILE_LABEL,
  VIEW_TITLE,
  type NovaProfile,
  type NovaView,
} from './workspaces';
import { StaleBanner } from './components/States';

const BROKER_WELCOME_BG = ['#23384A', '#42637A'] as const;

function isDemoContext(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const search = new URLSearchParams(window.location.search);
  return path === '/preview' || path === '/dev' || search.has('nova');
}

function LogoMark({ size = 25 }: { size?: number }) {
  return <Image source={FAVICON} style={{ width: size, height: size, borderRadius: 8 }} resizeMode="contain" />;
}

function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: keyof typeof statusTone;
}) {
  const t = statusTone[tone];
  return (
    <View style={[badgeStyle.row, { backgroundColor: t.bg }]}>
      <View style={[badgeStyle.dot, { backgroundColor: t.dot }]} />
      <Text style={[badgeStyle.text, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

const badgeStyle = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: {
    fontFamily: font.body,
    fontWeight: '800' as const,
    fontSize: 9.5,
  },
});

function PageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={headerWrap.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={headerWrap.eyebrowRow}>
          <View style={headerWrap.eyebrowLine} />
          <Text style={headerWrap.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={fonts.h1}>{title}</Text>
        <Text style={headerWrap.description}>{description}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity style={primaryBtn.base} onPress={onAction} activeOpacity={0.85}>
          <Text style={primaryBtn.text}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const headerWrap = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 28,
  },
  eyebrowRow: { flexDirection: 'row' as const, alignItems: 'center', gap: 8, marginBottom: 9 },
  eyebrowLine: { width: 22, height: 2, borderRadius: 2, backgroundColor: colors.coral600 },
  eyebrow: {
    color: colors.coral600,
    fontFamily: font.body,
    fontWeight: '800' as const,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  description: {
    marginTop: 8,
    color: semantic.textMuted,
    fontFamily: font.body,
    fontWeight: '400' as const,
    fontSize: 13,
    lineHeight: 19,
  },
});

const primaryBtn = StyleSheet.create({
  base: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    backgroundColor: colors.coral600,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.coral600,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  text: {
    color: '#fff',
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 12,
  },
});

function QuickAction({
  icon: Icon,
  label,
  tone,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  tone: keyof typeof statusTone;
  onPress?: () => void;
}) {
  const t = statusTone[tone];
  return (
    <TouchableOpacity style={quickAction.row} onPress={onPress} activeOpacity={0.8}>
      <View style={[quickAction.icon, { backgroundColor: t.bg }]}>
        <Icon size={18} color={t.fg} strokeWidth={2.1} />
      </View>
      <Text style={quickAction.label}>{label}</Text>
      <Text style={quickAction.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const quickAction = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate100,
    backgroundColor: semantic.card,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: semantic.textBody,
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 11,
  },
  chevron: {
    color: colors.slate500,
    fontSize: 16,
  },
});

function NovaBrokerHome({
  nomeGuerra,
  tenantName,
  onOpen,
}: {
  nomeGuerra?: string;
  tenantName?: string;
  onOpen: (v: NovaView) => void;
}) {
  const [activeSession, setActiveSession] = React.useState<any | null>(null);
  const [summary, setSummary] = React.useState<any | null>(null);
  const [phase, setPhase] = React.useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [current, dash] = await Promise.all([
          api.get('/presences/current'),
          api.get('/presences/dashboard-summary'),
        ]);
        if (cancelled) return;
        setActiveSession(current.data.hasActiveSession ? current.data.presence : null);
        setSummary(dash.data);
        setPhase('ready');
      } catch {
        if (cancelled) return;
        setPhase('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'loading') {
    return <View><Text style={fonts.bodySmall}>Carregando seu próximo plantão…</Text></View>;
  }
  if (phase === 'error') {
    return <View><Text style={fonts.bodySmall}>Não foi possível carregar seu próximo plantão.</Text></View>;
  }

  const nextShift = summary?.activeShift || activeSession;
  const isActive = !!activeSession;
  const hoursOpen = summary?.nextShiftOpenAtFormatted || (summary?.activeShift?.startedAt ? 'Em andamento' : undefined);

  return (
    <View>
      <PageHeader
        eyebrow="Jornada de campo"
        title="Meu próximo plantão"
        description="Tudo o que você precisa para chegar, fazer check-in e iniciar o atendimento."
      />
      <View style={[hero.row, { backgroundImage: `linear-gradient(115deg, ${BROKER_WELCOME_BG[0]}, ${BROKER_WELCOME_BG[1]})` } as any]}>
        <View style={hero.copy}>
          <StatusBadge tone={isActive ? 'positive' : 'attention'}>
            {isActive ? 'Você está em plantão' : hoursOpen ? `Check-in abre às ${hoursOpen}` : 'Check-in disponível'}
          </StatusBadge>
          <Text style={hero.title}>Olá, {nomeGuerra || 'corretor'}!</Text>
          <Text style={hero.subtitle}>
            {tenantName || 'ABIATAR'} · {isActive ? 'Sua presença está ativa.' : 'Toque em check-in para iniciar o turno.'}
          </Text>
          <View style={hero.meta}>
            <View style={hero.metaItem}>
              <MapPin size={14} color="rgba(255,255,255,0.85)" />
              <Text style={hero.metaText}>{nextShift?.booth?.name || nextShift?.boothName || 'Empreendimento'}</Text>
            </View>
            <View style={hero.metaItem}>
              <Clock3 size={14} color="rgba(255,255,255,0.85)" />
              <Text style={hero.metaText}>{nextShift?.shift?.startAtRaw || nextShift?.shiftStartAt || 'Próximo turno'}</Text>
            </View>
          </View>
        </View>
        <View style={hero.actions}>
          <TouchableOpacity style={hero.cta} onPress={() => onOpen('check_in')} activeOpacity={0.9}>
            <UserCheck size={17} color={colors.navy900} strokeWidth={2.2} />
            <Text style={hero.ctaText}>Efetuar check-in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hero.ctaGhost} onPress={() => onOpen('my_shifts')} activeOpacity={0.9}>
            <CalendarDays size={17} color="#fff" strokeWidth={2} />
            <Text style={hero.ctaGhostText}>Ver meus plantões</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={homeGrid.two}>
        <View style={[homeGrid.col, { gap: 9 }]}>
          <QuickAction icon={CheckCircle2} label="Check-in do plantão" tone="action" onPress={() => onOpen('check_in')} />
          <QuickAction icon={CalendarDays} label="Meus plantões" tone="info" onPress={() => onOpen('my_shifts')} />
        </View>
        <View style={[homeGrid.col, { gap: 9 }]}>
          <QuickAction icon={Building2} label="Materiais de atendimento" tone="positive" onPress={() => onOpen('my_shifts')} />
          <QuickAction icon={Bell} label="Mensagens / Inbox" tone="attention" onPress={() => onOpen('inbox')} />
        </View>
      </View>

      {Array.isArray(summary?.boothsEligibility) && summary.boothsEligibility.length > 0 && (
        <View style={panel.base}>
          <View style={panel.header}>
            <View>
              <Text style={panel.panelTitle}>Elegibilidade por plantão</Text>
              <Text style={panel.panelDesc}>Roletas cumpridas e requisitos de fim de semana</Text>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            {summary.boothsEligibility.map((booth: any) => (
              <View key={booth.boothId} style={elig.row}>
                <View style={{ flex: 1 }}>
                  <Text style={elig.name}>{booth.boothName}</Text>
                  <Text style={elig.detail}>
                    Roletas cumpridas: <Text style={{ fontWeight: '800' }}>{booth.validRoletasThisWeek}</Text>
                  </Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <StatusBadge tone={booth.saturdayEligible ? 'positive' : 'attention'}>
                    Sáb {booth.saturdayEligible ? 'elegível' : `faltam ${booth.missingSaturday}`}
                  </StatusBadge>
                  <StatusBadge tone={booth.sundayEligible ? 'positive' : 'attention'}>
                    Dom {booth.sundayEligible ? 'elegível' : `faltam ${booth.missingSunday}`}
                  </StatusBadge>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const hero = StyleSheet.create({
  row: {
    minHeight: 210,
    borderRadius: 13,
    padding: 28,
    marginBottom: 18,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    overflow: 'hidden',
    shadowColor: '#101C2A',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: '#fff',
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 24,
    letterSpacing: -1,
    marginTop: 16,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: font.body,
    fontWeight: '400' as const,
    fontSize: 12.5,
    marginTop: 5,
  },
  meta: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16, marginTop: 20 },
  metaItem: { flexDirection: 'row' as const, alignItems: 'center', gap: 6 },
  metaText: { color: 'rgba(255,255,255,0.85)', fontFamily: font.body, fontWeight: '500' as const, fontSize: 11.5 },
  actions: { gap: 9, zIndex: 2 },
  cta: {
    minWidth: 180,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaText: { color: colors.navy900, fontFamily: font.body, fontWeight: '800' as const, fontSize: 12.5 },
  ctaGhost: {
    minWidth: 180,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  ctaGhostText: { color: '#fff', fontFamily: font.body, fontWeight: '700' as const, fontSize: 12 },
});

const homeGrid = StyleSheet.create({
  two: {
    flexDirection: 'row' as const,
    gap: 18,
    marginBottom: 18,
  },
  col: { flex: 1, minWidth: 0 },
});

const panel = StyleSheet.create({
  base: {
    padding: 22,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.card,
    marginBottom: 18,
    ...shadow.card,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 15,
    minHeight: 38,
    marginBottom: 12,
  },
  panelTitle: {
    color: semantic.textPrimary,
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 14,
    letterSpacing: -0.3,
  },
  panelDesc: {
    color: colors.slate500,
    fontFamily: font.body,
    fontWeight: '400' as const,
    fontSize: 11,
    marginTop: 5,
  },
});

const elig = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  name: { color: semantic.textBody, fontFamily: font.body, fontWeight: '700' as const, fontSize: 12 },
  detail: { color: colors.slate500, fontFamily: font.body, fontWeight: '400' as const, fontSize: 11, marginTop: 4 },
});

function NovaMyShifts() {
  const [summary, setSummary] = React.useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/presences/dashboard-summary')
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const shifts = Array.isArray(summary?.shifts) ? summary.shifts : Array.isArray(summary?.boothsEligibility) ? summary.boothsEligibility : [];

  return (
    <View>
      <PageHeader
        eyebrow="Escala do corretor"
        title="Meus plantões"
        description="Roletas da semana e elegibilidade por plantão."
      />
      <View style={panel.base}>
        <View style={panel.header}>
          <View>
            <Text style={panel.panelTitle}>Minhas roletas da semana</Text>
            <Text style={panel.panelDesc}>Contagem semanal (Segunda a Domingo)</Text>
          </View>
          <StaleBanner updatedAt="agora" />
        </View>

        <View style={shifts.summary}>
          <Text style={shifts.summaryValue}>{summary?.validPeriods ?? summary?.validRoletas ?? 0}</Text>
          <Text style={shifts.summaryLabel}>Roletas cumpridas</Text>
        </View>

        {summary?.invalidatedPeriods > 0 && (
          <View style={shifts.invalid}>
            <Text style={shifts.invalidText}>Roletas incompletas / invalidadas: {summary.invalidatedPeriods}</Text>
          </View>
        )}

        {shifts.length === 0 && (
          <View style={{ paddingVertical: 18 }}>
            <Text style={{ color: colors.slate500, fontFamily: font.body, fontSize: 12 }}>
              Nenhuma informação encontrada.
            </Text>
          </View>
        )}

        {shifts.length > 0 && (
          <View style={{ marginTop: 8, gap: 9 }}>
            {shifts.map((shift: any) => {
              const name = shift.boothName || shift.booth?.name || shift.name || 'Plantão';
              const roletas = shift.validRoletasThisWeek ?? shift.validRoletas ?? shift.count ?? 0;
              return (
                <View key={shift.boothId ?? shift.id ?? name} style={shifts.row}>
                  <View style={shifts.rowIcon}>
                    <MapPin size={16} color={colors.coral600} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={shifts.rowName}>{name}</Text>
                    <Text style={shifts.rowDetail}>Roletas cumpridas: {roletas}</Text>
                  </View>
                  <StatusBadge tone={(summary?.validPeriods ?? 0) > 0 ? 'positive' : 'neutral'}>Semana atual</StatusBadge>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const shifts = StyleSheet.create({
  summary: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  summaryValue: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 32,
    letterSpacing: -1.5,
    color: colors.navy900,
  },
  summaryLabel: {
    marginTop: 4,
    color: colors.slate500,
    fontFamily: font.body,
    fontWeight: '600' as const,
    fontSize: 11,
  },
  invalid: {
    marginTop: 6,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.amber100,
  },
  invalidText: {
    color: colors.amber700,
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 11.5,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.coral050,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { color: semantic.textBody, fontFamily: font.body, fontWeight: '700' as const, fontSize: 12 },
  rowDetail: { color: colors.slate500, fontFamily: font.body, fontWeight: '400' as const, fontSize: 11, marginTop: 4 },
});

export default function DashboardNova() {
  useNovaFonts();
  const { user, tenant, logout } = useAuth();
  const { width } = useWindowDimensions();

  const demo = isDemoContext();
  const profileFromRole = profileForRole(user?.role);
  const [demoProfile, setDemoProfile] = useState<NovaProfile>(profileFromRole);
  const profile: NovaProfile = demo ? demoProfile : profileFromRole;
  const [view, setView] = useState<NovaView>(() => firstView(profileFromRole));

  const [collapsed, setCollapsed] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const isMobile = width < 768;
  const sidebarOffset = isMobile ? 0 : collapsed ? 76 : 256;
  const topOffset = isMobile ? 0 : 72;

  const meta = PROFILES.find((p) => p.profile === profile) ?? PROFILES[0];
  const nav = meta.nav;
  const currentLabel = VIEW_TITLE[view] ?? 'Visão geral';

  useEffect(() => {
    if (profile !== demoProfile && demo) {
      setView(firstView(profile));
    }
  }, [profile, demoProfile, demo]);

  function renderContent() {
    const onBack = () => setView(firstView(profile));

    if (profile === 'corretor') {
      if (view === 'command') {
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={contentPad}>
            <NovaBrokerHome nomeGuerra={user?.nome_guerra} tenantName={tenant?.name} onOpen={setView} />
          </ScrollView>
        );
      }
      if (view === 'check_in') {
        return <CheckIn onCheckInSuccess={() => setView('command')} />;
      }
      if (view === 'my_shifts') {
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={contentPad}>
            <NovaMyShifts />
          </ScrollView>
        );
      }
      if (view === 'inbox') return <Inbox onBack={onBack} />;
    }

    if (profile === 'recepcao') {
      if (view === 'inbox') return <Inbox onBack={onBack} />;
      return <NovaReception view={view} onOpen={setView} isMobile={isMobile} />;
    }

    // Diretoria / Gerência / RH
    if (profile === 'diretoria' && view === 'command') {
      return <NovaCommandCenter isMobile={isMobile} />;
    }

    switch (view) {
      case 'operation':
        return <NovaOperacao isMobile={isMobile} />;
      case 'people':
        return <NovaPessoas isMobile={isMobile} sidebarOffset={sidebarOffset} topOffset={topOffset} />;
      case 'performance':
        return <NovaPerformance isMobile={isMobile} />;
      case 'messaging':
        return <NovaMensagens isMobile={isMobile} isManager={profile === 'gerencia'} />;
      case 'team':
        if (profile === 'gerencia') return <NovaMinhaEquipe isMobile={isMobile} managerId={user?.id} />;
        return <ManagerPanel onBack={onBack} />;
      case 'command':
      case 'rh_credentials':
      case 'rh_careers':
      default:
        if (profile === 'rh') {
          if (view === 'rh_credentials' || view === 'rh_careers') return <NovaPerfisRh view={view} isMobile={isMobile} sidebarOffset={sidebarOffset} topOffset={topOffset} />;
          return <NovaVisaoRh isMobile={isMobile} />;
        }
        if (profile === 'gerencia') return <NovaMinhaEquipe isMobile={isMobile} managerId={user?.id} />;
        return <NovaPerformance isMobile={isMobile} />;
    }
  }

  function handleLogout() {
    void logout();
  }

  const sidebarVisible = !isMobile;
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

  return renderDesktopShell();

  function renderDesktopShell() {
    return (
    <View style={shell.root}>
      {sidebarVisible && (
        <View style={[shell.sidebar, collapsed && shell.sidebarCollapsed]}>
          <View style={shell.sidebarTop}>
            <LogoMark />
            {!collapsed && (
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={shell.brand}>abiatar</Text>
                <Text style={shell.brandSub}>real estate ops</Text>
              </View>
            )}
            <TouchableOpacity style={shell.sidebarIconBtn} onPress={() => setCollapsed(!collapsed)} accessibilityLabel="Alternar menu">
              {collapsed ? <PanelLeftOpen size={17} color="#9EB0C1" /> : <PanelLeftClose size={17} color="#9EB0C1" />}
            </TouchableOpacity>
          </View>

          {demo && (
            <View style={shell.workspaceSwitcher}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}
                onPress={() => setProfileMenu(!profileMenu)}
              >
                <View style={[shell.switchAvatar, { backgroundColor: statusTone[meta.accent].fg }]}>
                  <Text style={{ color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 10 }}>{meta.initials}</Text>
                </View>
                {!collapsed && (
                  <>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: '#fff', fontFamily: font.body, fontWeight: '700', fontSize: 12 }}>{meta.label}</Text>
                      <Text style={{ color: '#73889B', fontFamily: font.body, fontWeight: '400', fontSize: 10 }}>{meta.subtitle}</Text>
                    </View>
                    <ChevronDown size={14} color="#73889B" />
                  </>
                )}
              </TouchableOpacity>
              {profileMenu && !collapsed && (
                <View style={shell.roleMenu}>
                  {PROFILES.map((p) => (
                    <TouchableOpacity
                      key={p.profile}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderRadius: radius.md }}
                      onPress={() => {
                        setDemoProfile(p.profile);
                        setProfileMenu(false);
                      }}
                    >
                      <View style={[shell.switchAvatar, { backgroundColor: statusTone[p.accent].fg }]}>
                        <Text style={{ color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 10 }}>{p.initials}</Text>
                      </View>
                      <Text style={{ color: '#D9E2EC', fontFamily: font.body, fontWeight: '400', fontSize: 12, flex: 1 }}>{p.label}</Text>
                      {p.profile === profile && <Check size={14} color={colors.coral500} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {!collapsed && <Text style={shell.navLabel}>Workspace</Text>}
          <View style={shell.nav}>
            {nav.map(({ view: v, label, icon: Icon }) => (
              <TouchableOpacity key={v} style={[shell.navItem, view === v && shell.navItemActive]} onPress={() => setView(v)} accessibilityRole="button">
                <Icon size={18} color={view === v ? colors.coral500 : '#A6B7C7'} strokeWidth={2} />
                {!collapsed && <Text style={shell.navItemText}>{label}</Text>}
                {!collapsed && view === v && <View style={shell.navActiveLine} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={shell.sidebarBottom}>
            <TouchableOpacity style={shell.navItem}>
              <CircleHelp size={17} color="#A6B7C7" strokeWidth={2} />
              {!collapsed && <Text style={shell.navItemText}>Central de ajuda</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={shell.navItem}>
              <Settings2 size={17} color="#A6B7C7" strokeWidth={2} />
              {!collapsed && <Text style={shell.navItemText}>Configurações</Text>}
            </TouchableOpacity>
            <View style={shell.sidebarUser}>
              <View style={[shell.switchAvatar, { backgroundColor: statusTone[meta.accent].fg }]}>
                <Text style={{ color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 10 }}>{meta.initials}</Text>
              </View>
              {!collapsed && (
                <>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontFamily: font.body, fontWeight: '600', fontSize: 11.5 }}>{user?.nome_guerra || 'Usuário'}</Text>
                    <Text style={{ color: '#73889B', fontFamily: font.body, fontWeight: '400', fontSize: 10 }}>Sessão segura</Text>
                  </View>
                  <TouchableOpacity onPress={handleLogout} accessibilityLabel="Sair">
                    <LogOut size={16} color="#73889B" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={[shell.main, !sidebarVisible && { width: '100%', marginLeft: 0 }]}>
        <View style={shell.topbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LogoMark size={21} />
                <Text style={{ color: colors.navy900, fontFamily: font.display, fontWeight: '800', fontSize: 15 }}>abiatar</Text>
              </View>
            )}
            {!isMobile && (
              <View style={shell.breadcrumb}>
                <Text style={shell.breadcrumbMuted}>Abiatar</Text>
                <Text style={shell.breadcrumbSep}>/</Text>
                <Text style={shell.breadcrumbRole}>{meta.label}</Text>
                <Text style={shell.breadcrumbSep}>/</Text>
                <Text style={shell.breadcrumbCurrent}>{currentLabel}</Text>
              </View>
            )}
          </View>
          {!isMobile && (
            <View style={shell.topActions}>
              <TouchableOpacity style={shell.periodSelector}>
                <CalendarDays size={14} color={colors.slate600} />
                <Text style={shell.periodText}>{today}</Text>
                <ChevronDown size={13} color={colors.slate500} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={shell.content}>{renderContent()}</View>

        {isMobile && (
          <View style={shell.bottomNav}>
            {nav.slice(0, 4).map(({ view: v, label, icon: Icon }) => (
              <TouchableOpacity key={v} style={[shell.bottomItem, view === v && shell.bottomItemActive]} onPress={() => setView(v)}>
                <Icon size={18} color={view === v ? colors.coral600 : colors.slate500} strokeWidth={2} />
                <Text style={[shell.bottomItemText, view === v && { color: colors.coral600 }]}>{label.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
</View>
      </View>
    );
  }
}

const contentPad = { padding: 38, paddingTop: 34, paddingBottom: 64, maxWidth: 1500, alignSelf: 'center' as const, width: '100%' as const };

const shell = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' as const, backgroundColor: semantic.background },
  sidebar: {
    width: 256,
    backgroundColor: colors.navy900,
    paddingTop: 0,
    overflow: 'hidden',
    shadowColor: '#101C2A',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 8, height: 0 },
    elevation: 8,
  },
  sidebarCollapsed: { width: 76 },
  sidebarTop: {
    height: 88,
    paddingHorizontal: 22,
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brand: { color: '#fff', fontFamily: font.body, fontWeight: '800', fontSize: 16, letterSpacing: -0.4 },
  brandSub: { marginTop: 2, color: '#73889B', fontFamily: font.body, fontWeight: '700', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' as const },
  sidebarIconBtn: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  workspaceSwitcher: {
    position: 'relative' as const,
    marginHorizontal: 14,
    marginTop: 18,
    marginBottom: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  switchAvatar: {
    width: 29,
    height: 29,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMenu: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)' as any,
    left: 0,
    right: 0,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    backgroundColor: colors.navy800,
  },
  navLabel: {
    paddingHorizontal: 23,
    paddingBottom: 8,
    color: '#73889B',
    fontFamily: font.body,
    fontWeight: '800' as const,
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  nav: { gap: 4, paddingHorizontal: 12 },
  navItem: {
    position: 'relative' as const,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 13,
    borderRadius: radius.md,
  },
  navItemActive: { backgroundColor: 'rgba(217,87,69,0.12)' },
  navItemText: { color: '#A6B7C7', fontFamily: font.body, fontWeight: '600' as const, fontSize: 12 },
  navActiveLine: { position: 'absolute' as const, right: -12, width: 3, height: 20, borderRadius: 3, backgroundColor: colors.coral500 },
  sidebarBottom: { marginTop: 'auto' as const, padding: '12px 12px 18px' as any, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  sidebarUser: {
    marginTop: 15,
    paddingTop: 12,
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  main: { flex: 1, minWidth: 0 },
  topbar: {
    height: 72,
    paddingHorizontal: 34,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: semantic.border,
  },
  breadcrumb: { flexDirection: 'row' as const, alignItems: 'center', gap: 10, flex: 1 },
  breadcrumbMuted: { color: colors.slate500, fontFamily: font.body, fontWeight: '400', fontSize: 12 },
  breadcrumbRole: { color: colors.slate800, fontFamily: font.body, fontWeight: '700', fontSize: 12 },
  breadcrumbCurrent: { color: colors.slate500, fontFamily: font.body, fontWeight: '400', fontSize: 12 },
  breadcrumbSep: { color: colors.slate300 },
  topActions: { flexDirection: 'row' as const, alignItems: 'center', gap: 14 },
  periodSelector: { height: 34, paddingHorizontal: 11, flexDirection: 'row' as const, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: semantic.border, borderRadius: radius.md, backgroundColor: '#fff' },
  periodText: { color: colors.slate700, fontFamily: font.body, fontWeight: '600', fontSize: 11 },
  content: { flex: 1 },
  bottomNav: {
    height: 67,
    flexDirection: 'row' as const,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: semantic.border,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  bottomItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 9 },
  bottomItemActive: { backgroundColor: colors.coral050, borderRadius: radius.sm },
  bottomItemText: { color: colors.slate500, fontFamily: font.body, fontWeight: '700', fontSize: 9 },
});