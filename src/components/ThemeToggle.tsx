'use client';

import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * Interruptor de tema (claro/oscuro). El estado inicial llega del servidor (lee la cookie en el
 * layout) para que no haya desajuste de hidratación ni parpadeo. Al alternar: persiste la cookie
 * (1 año) y voltea la clase `.dark` del `<body>` para feedback inmediato sin recargar. La clase
 * `.dark` vive en `<body>` (RootLayout la fija desde la cookie) y es la ÚNICA fuente del tema:
 * cubre toda la app + landing/auth/legal, así que voltear el body re-tematiza todo de una.
 */
export function ThemeToggle({
  initialDark,
  variant = 'full',
}: {
  initialDark: boolean;
  /** 'full' = botón ancho con etiqueta (sidebar); 'icon' = solo ícono (nav de la landing). */
  variant?: 'full' | 'icon';
}) {
  const [dark, setDark] = useState(initialDark);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.body.classList.toggle('dark', next);
    document.cookie = `ei-theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        aria-label={label}
        title={dark ? 'Modo claro' : 'Modo oscuro'}
        className="flex items-center justify-center rounded-lg border border-line bg-surface p-2 text-ink-soft transition-colors hover:text-ink"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={label}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-bg hover:text-ink"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {dark ? 'Modo claro' : 'Modo oscuro'}
    </button>
  );
}
