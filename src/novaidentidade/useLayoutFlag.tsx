// Resolve qual camada de interface renderizar.
// Prioridade: URL ?nova=… (demo/avaliação) > EXPO_PUBLIC_LAYOUT > features.nova_identidade (tenant) > nova (padrão).
// A nova identidade é o padrão; a flag pode ser desligada explicitamente (false) via DevDashboard.

import { StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export type LayoutMode = 'nova' | 'classica';

function getUrlOverride(): LayoutMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('nova');
    if (value === null) return null;
    return value === '0' || value === 'false' ? 'classica' : 'nova';
  } catch {
    return null;
  }
}

function getEnvMode(): LayoutMode | null {
  const env = process.env.EXPO_PUBLIC_LAYOUT;
  if (!env) return null;
  return env === 'nova' || env === 'classica' ? env : null;
}

export function resolveLayoutMode(tenantFeature?: boolean): LayoutMode {
  const url = getUrlOverride();
  if (url) return url;
  const env = getEnvMode();
  if (env) return env;
  if (tenantFeature === false) return 'classica';
  return 'nova';
}

export function useLayoutFlag(): { layout: LayoutMode; isNova: boolean } {
  const { tenant } = useAuth();
  const feature =
    typeof tenant?.settings?.features?.nova_identidade === 'boolean'
      ? tenant.settings.features.nova_identidade
      : undefined;
  const layout = resolveLayoutMode(feature);
  return { layout, isNova: layout === 'nova' };
}

export const layoutStyles = StyleSheet.create({
  novaContainer: {
    flex: 1,
    backgroundColor: '#F6F8FA',
  },
});