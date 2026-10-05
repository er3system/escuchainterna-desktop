'use client';

import { Moon, Sun } from 'lucide-react';
import { useAppearance } from './appearance/AppearanceProvider';

export function ThemeToggle({ variant = 'full' }: { initialDark?: boolean; variant?: 'full' | 'icon' }) {
  const { dark, update } = useAppearance();
  const label = dark ? 'Cambiar a modo día' : 'Cambiar a modo noche';
  return (
    <button type="button" onClick={() => update({ mode: dark ? 'light' : 'dark' })} aria-pressed={dark} aria-label={label} title={label}
      className={variant === 'icon' ? 'ei-option flex items-center justify-center rounded-xl border border-line bg-surface p-2.5 text-ink-soft' : 'ei-option flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-bg hover:text-ink'}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}{variant === 'full' ? dark ? 'Modo día' : 'Modo noche' : null}
    </button>
  );
}
