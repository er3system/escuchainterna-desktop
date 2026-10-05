export const PALETTES = [
  { id: 'bosque', name: 'Bosque', description: 'Pino, helecho y salvia sobre papel', color: '#245b43', companion: '#8ba66b', paper: '#f5f3ed' },
  { id: 'salvia', name: 'Salvia', description: 'Eucalipto, oliva y arena cálida', color: '#42634e', companion: '#aca66a', paper: '#f5f2e9' },
  { id: 'jardin', name: 'Jardín', description: 'Verde hoja, menta y verde azulado', color: '#276447', companion: '#619b93', paper: '#f0f5ef' },
  { id: 'oceano', name: 'Océano', description: 'Azul profundo, verde mar y perla', color: '#315d91', companion: '#699b92', paper: '#f1f4f8' },
  { id: 'lavanda', name: 'Lavanda', description: 'Violeta, salvia y fondo mineral', color: '#70528d', companion: '#92a282', paper: '#f5f3f8' },
  { id: 'terracota', name: 'Terracota', description: 'Arcilla, oliva y tonos de arena', color: '#995138', companion: '#8a976a', paper: '#f8f3ee' },
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
