// Abiatar Enterprise — nova identidade (navy/coral)
// Bloco A aprovado: paleta fixa, tipografia Manrope+DM Sans, radius/spacing 4px.

export const colors = {
  ink900: '#17212B' as const,
  navy950: '#101C2A' as const,
  navy900: '#17212B' as const,
  navy800: '#23384A' as const,
  navy700: '#2F4A60' as const,
  coral600: '#D95745' as const,
  coral500: '#E66B59' as const,
  coral050: '#FFF3F0' as const,
  slate950: '#1F2933' as const,
  slate800: '#334155' as const,
  slate700: '#475569' as const,
  slate600: '#64748B' as const,
  slate500: '#8291A3' as const,
  slate300: '#CBD5E1' as const,
  slate200: '#E2E8F0' as const,
  slate100: '#EEF2F6' as const,
  slate050: '#F6F8FA' as const,
  green700: '#137653' as const,
  green100: '#E4F4EE' as const,
  blue700: '#22618C' as const,
  blue100: '#E5F1F8' as const,
  amber700: '#A36312' as const,
  amber100: '#FFF2D7' as const,
  red700: '#BD3E36' as const,
  red100: '#FDE8E6' as const,
} as const;

export const semantic = {
  background: '#F6F8FA' as const,
  foreground: '#1F2933' as const,
  card: '#FFFFFF' as const,
  border: '#E2E8F0' as const,
  divider: '#EEF2F6' as const,
  textPrimary: '#1F2933' as const,
  textBody: '#334155' as const,
  textSecondary: '#475569' as const,
  textMuted: '#64748B' as const,
  textFaint: '#8291A3' as const,
  onNavy: '#FFFFFF' as const,
  onNavySecondary: '#9EB0C1' as const,
  onNavyLabel: '#73889B' as const,
  action: '#D95745' as const,
  actionHover: '#BE4435' as const,
  actionSoft: '#FFF3F0' as const,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  full: 999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

// Base 4px: 8, 12, 16, 24, 32
export const space = (n: number) => n * 4;

export const font = {
  display: 'Manrope',
  body: 'DM Sans',
} as const;

// Tipografia — spec §6.4 (Manrope títulos/métricas, DM Sans corpo)
export const fonts = {
  h1: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -1.4,
  },
  h1Mobile: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -1.2,
  },
  panelTitle: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  metricValue: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: -1.4,
  },
  metricValueMobile: {
    fontFamily: font.display,
    fontWeight: '800' as const,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -1.1,
  },
  body: {
    fontFamily: font.body,
    fontWeight: '500' as const,
    fontSize: 12.5,
    lineHeight: 18,
  },
  bodySmall: {
    fontFamily: font.body,
    fontWeight: '400' as const,
    fontSize: 11,
    lineHeight: 15,
  },
  label: {
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  labelTab: {
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.8,
  },
  micro: {
    fontFamily: font.body,
    fontWeight: '600' as const,
    fontSize: 9.5,
    lineHeight: 13,
  },
  button: {
    fontFamily: font.body,
    fontWeight: '700' as const,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: '#263748',
    shadowOpacity: 0.035,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#101C2A',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export type StateTone = 'positive' | 'info' | 'attention' | 'danger' | 'neutral' | 'action';

export const statusTone: Record<
  StateTone,
  { bg: string; fg: string; dot: string }
> = {
  positive: { bg: colors.green100, fg: colors.green700, dot: colors.green700 },
  info: { bg: colors.blue100, fg: colors.blue700, dot: colors.blue700 },
  attention: { bg: colors.amber100, fg: colors.amber700, dot: colors.amber700 },
  danger: { bg: colors.red100, fg: colors.red700, dot: colors.red700 },
  neutral: { bg: colors.slate100, fg: colors.slate600, dot: colors.slate600 },
  action: { bg: colors.coral050, fg: colors.coral600, dot: colors.coral600 },
};