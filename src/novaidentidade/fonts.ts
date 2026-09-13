// Carregamento das fontes da nova identidade.
// Web (PWA): injeta Google Fonts via <link> (DM Sans + Manrope).
// Native: tenta expo-font; em erro, usa fallback de sistema (decisão A2).

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap';

function loadWebFonts(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.getElementById('nova-google-fonts')) return true;
  const link = document.createElement('link');
  link.id = 'nova-google-fonts';
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
  return true;
}

export function useNovaFonts(): { fontsLoaded: boolean } {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        setFontsLoaded(loadWebFonts());
      } catch {
        setFontsLoaded(true);
      }
      return;
    }

    let mounted = true;
    setFontsLoaded(true);
    return () => {
      mounted = false;
    };
  }, []);

  return { fontsLoaded };
}