// Workspaces por papel — Bloco B/C aprovados.
// Cada perfil enxerga apenas a própria navegação; no modo demo o switcher troca o perfil.

import {
  Activity,
  Building2,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

export type NovaView =
  | 'command'
  | 'operation'
  | 'booth_rules'
  | 'team'
  | 'people'
  | 'performance'
  | 'messaging'
  | 'check_in'
  | 'my_shifts'
  | 'inbox'
  | 'materials'
  | 'rh_careers'
  | 'rh_credentials';

export type NovaProfile = 'diretoria' | 'gerencia' | 'recepcao' | 'rh' | 'corretor';

export const ROLE_TO_PROFILE: Record<string, NovaProfile> = {
  diretoria_level_1: 'diretoria',
  platform_admin_level_0: 'diretoria',
  gerencia_level_2: 'gerencia',
  recepcao_level_3: 'recepcao',
  rh_level_1: 'rh',
  rh_level_2: 'rh',
  corretor_level_3: 'corretor',
};

export interface NavItem {
  view: NovaView;
  label: string;
  icon: LucideIcon;
}

export interface ProfileMeta {
  profile: NovaProfile;
  label: string;
  subtitle: string;
  initials: string;
  accent: 'action' | 'info' | 'positive' | 'attention';
  nav: NavItem[];
}

export const PROFILE_LABEL: Record<NovaProfile, string> = {
  diretoria: 'Diretoria',
  gerencia: 'Gerência',
  recepcao: 'Recepção',
  rh: 'RH',
  corretor: 'Corretor',
};

export const PROFILES: ProfileMeta[] = [
  {
    profile: 'diretoria',
    label: 'Diretoria',
    subtitle: 'Visão executiva',
    initials: 'DC',
    accent: 'action',
    nav: [
      { view: 'command', label: 'Command Center', icon: LayoutDashboard },
      { view: 'operation', label: 'Operação', icon: Activity },
      { view: 'people', label: 'Pessoas e equipes', icon: Users },
      { view: 'performance', label: 'Performance', icon: TrendingUp },
      { view: 'messaging', label: 'Comunicação', icon: MessageSquare },
    ],
  },
  {
    profile: 'gerencia',
    label: 'Gerência',
    subtitle: 'Workspace tático',
    initials: 'GT',
    accent: 'info',
    nav: [
      { view: 'team', label: 'Minha equipe', icon: Users },
      { view: 'operation', label: 'Operação', icon: Activity },
      { view: 'messaging', label: 'Comunicação', icon: MessageSquare },
      { view: 'people', label: 'Pessoas e equipes', icon: Building2 },
      { view: 'performance', label: 'Performance', icon: TrendingUp },
    ],
  },
  {
    profile: 'recepcao',
    label: 'Recepção',
    subtitle: 'Operação ao vivo',
    initials: 'RC',
    accent: 'positive',
    nav: [
      { view: 'command', label: 'Cockpit do plantão', icon: LayoutDashboard },
      { view: 'operation', label: 'Fila de atendimento', icon: Target },
      { view: 'inbox', label: 'Mensagens', icon: MessageSquare },
    ],
  },
  {
    profile: 'rh',
    label: 'RH',
    subtitle: 'Governança de pessoas',
    initials: 'RH',
    accent: 'attention',
    nav: [
      { view: 'command', label: 'Visão RH', icon: LayoutDashboard },
      { view: 'rh_careers', label: 'Carreiras e estágios', icon: Users },
      { view: 'rh_credentials', label: 'Vigências e CRECI', icon: ShieldCheck },
      { view: 'performance', label: 'Performance', icon: TrendingUp },
    ],
  },
  {
    profile: 'corretor',
    label: 'Corretor',
    subtitle: 'Jornada de campo',
    initials: 'TS',
    accent: 'action',
    nav: [
      { view: 'command', label: 'Meu próximo plantão', icon: CalendarDays },
      { view: 'my_shifts', label: 'Meus plantões', icon: Clock3 },
      { view: 'check_in', label: 'Check-in do plantão', icon: UserCheck },
      { view: 'inbox', label: 'Mensagens', icon: MessageSquare },
    ],
  },
];

export function profileForRole(role?: string): NovaProfile {
  if (role && ROLE_TO_PROFILE[role]) return ROLE_TO_PROFILE[role];
  return 'corretor';
}

export function firstView(profile: NovaProfile): NovaView {
  return (
    PROFILES.find((p) => p.profile === profile)?.nav[0]?.view ?? 'command'
  );
}

export const VIEW_TITLE: Record<string, string> = {
  command: 'Visão geral',
  operation: 'Operação',
  booth_rules: 'Plantões e escalas',
  team: 'Minha equipe',
  people: 'Pessoas e equipes',
  performance: 'Performance',
  messaging: 'Comunicação',
  check_in: 'Check-in do plantão',
  my_shifts: 'Meus plantões',
  inbox: 'Mensagens',
  materials: 'Materiais',
  rh_careers: 'Carreiras e estágios',
  rh_credentials: 'Vigências e CRECI',
};