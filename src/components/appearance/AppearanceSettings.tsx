'use client';

import { Check, Monitor, Moon, Sun, Sparkles, Palette } from 'lucide-react';
import { PALETTES } from './appearancePreferences';
import { useAppearance } from './AppearanceProvider';

export function AppearanceSettings({ compact = false }: { compact?: boolean }) {
  const { preferences, update } = useAppearance();
  return (
    <section className="ei-card rounded-card border border-line bg-surface p-6 shadow-card" aria-label="Apariencia">
      <div className="mb-5 flex items-center gap-3">
        <span className="ei-icon-tile"><Palette size={20} /></span>
        <div><h2 className="font-display text-lg font-bold">Hazlo tuyo</h2><p className="text-xs text-ink-soft">Los cambios se aplican al instante y se guardan en este equipo.</p></div>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Iluminación</legend>
        <div className="grid grid-cols-3 gap-2">
          {([{ id: 'light', label: 'Día', icon: Sun }, { id: 'dark', label: 'Noche', icon: Moon }, { id: 'system', label: 'Automático', icon: Monitor }] as const).map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} aria-pressed={preferences.mode === id} onClick={() => update({ mode: id })} className={`ei-option flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm ${preferences.mode === id ? 'border-accent-strong bg-primary-light font-semibold text-primary' : 'border-line text-ink-soft'}`}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="mb-3 text-sm font-semibold">Paleta de color</legend>
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {PALETTES.map(palette => (
            <button type="button" key={palette.id} aria-pressed={preferences.palette === palette.id} onClick={() => update({ palette: palette.id })} className={`ei-option rounded-xl border p-3 text-left ${preferences.palette === palette.id ? 'border-accent-strong bg-primary-light/50' : 'border-line'}`}>
              <span className="mb-3 flex h-14 items-center justify-between rounded-lg px-3" style={{ background: `linear-gradient(125deg, ${palette.color}, ${palette.color}80)` }}>
                <span className="h-6 w-10 rounded-md border border-white/40 bg-white/20" />
                {preferences.palette === palette.id ? <Check className="text-white" size={18} /> : null}
              </span>
              <span className="block text-sm font-semibold">{palette.name}</span>
              {!compact ? <span className="mt-1 block text-xs text-ink-soft">{palette.description}</span> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} /> Movimiento suave</h3><p className="mt-1 text-xs text-ink-soft">Transiciones y efectos sutiles. Se respeta el movimiento reducido de Windows.</p></div>
        <button type="button" role="switch" aria-label="Movimiento suave" aria-checked={preferences.motion === 'standard'} onClick={() => update({ motion: preferences.motion === 'standard' ? 'reduced' : 'standard' })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${preferences.motion === 'standard' ? 'bg-primary' : 'bg-line'}`}>
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${preferences.motion === 'standard' ? 'left-1 translate-x-5' : 'left-1'}`} />
        </button>
      </div>
    </section>
  );
}
