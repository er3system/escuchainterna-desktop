export const PALETTES = [
  { id: 'bosque', name: 'Bosque', description: 'Verde profundo y papel cálido', color: '#286454' },
  { id: 'oceano', name: 'Océano', description: 'Azul sereno y gris perla', color: '#315d91' },
  { id: 'lavanda', name: 'Lavanda', description: 'Violeta suave y fondo mineral', color: '#70528d' },
  { id: 'terracota', name: 'Terracota', description: 'Arcilla y tonos de arena', color: '#995138' },
] as const;

export type AppearanceMode = 'light' | 'dark' | 'system';
export type AppearancePalette = typeof PALETTES[number]['id'];
export interface AppearancePreferences {
  mode: AppearanceMode;
  palette: AppearancePalette;
  motion: 'standard' | 'reduced';
}

export function parseAppearance(mode?: string, palette?: string, motion?: string): AppearancePreferences {
  return {
    mode: mode === 'light' || mode === 'dark' ? mode : 'system',
    palette: PALETTES.some(item => item.id === palette) ? palette as AppearancePalette : 'bosque',
    motion: motion === 'reduced' ? 'reduced' : 'standard',
  };
}

// Only fixed, validated preferences enter the document. Runs before first paint.
export function appearanceBootstrap(preferences: AppearancePreferences): string {
  return `(()=>{const p=${JSON.stringify(preferences)};const h=document.documentElement;h.classList.toggle('dark',p.mode==='dark'||(p.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));h.dataset.palette=p.palette;h.dataset.motion=p.motion;})();`;
}
