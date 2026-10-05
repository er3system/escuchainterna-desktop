'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppearancePreferences } from './appearancePreferences';

interface AppearanceContextValue {
  preferences: AppearancePreferences;
  dark: boolean;
  update: (changes: Partial<AppearancePreferences>) => void;
}
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ initial, children }: { initial: AppearancePreferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);
  const [dark, setDark] = useState(initial.mode === 'dark');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = preferences.mode === 'dark' || (preferences.mode === 'system' && media.matches);
      const html = document.documentElement;
      html.classList.toggle('dark', resolved);
      html.dataset.palette = preferences.palette;
      html.dataset.motion = preferences.motion;
      html.style.colorScheme = resolved ? 'dark' : 'light';
      setDark(resolved);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences]);

  function update(changes: Partial<AppearancePreferences>) {
    const next = { ...preferences, ...changes };
    for (const [key, value] of [['ei-theme', next.mode], ['ei-palette', next.palette], ['ei-motion', next.motion]]) {
      document.cookie = `${key}=${value}; path=/; max-age=31536000; samesite=lax`;
    }
    setPreferences(next);
  }

  return <AppearanceContext.Provider value={{ preferences, dark, update }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('La apariencia necesita su proveedor.');
  return context;
}
