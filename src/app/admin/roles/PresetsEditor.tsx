'use client';

import { useState, useTransition } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { PermissionsEditor, DEFAULT_PERMISSIONS, type PermissionsValue } from '../PermissionsEditor';
import { savePermissionPresetsAction, type SavePresetsResult } from './actions';

export interface PresetItem {
  name: string;
  permissions: PermissionsValue;
}

export function PresetsEditor({ initialPresets }: { initialPresets: PresetItem[] }) {
  const [presets, setPresets] = useState<PresetItem[]>(initialPresets);
  const [result, setResult] = useState<SavePresetsResult | null>(null);
  const [pending, startTransition] = useTransition();

  function updatePreset(index: number, next: Partial<PresetItem>) {
    setPresets((previous) => previous.map((preset, i) => (i === index ? { ...preset, ...next } : preset)));
  }

  function removePreset(index: number) {
    setPresets((previous) => previous.filter((_, i) => i !== index));
  }

  function addPreset() {
    setPresets((previous) => [...previous, { name: '', permissions: { ...DEFAULT_PERMISSIONS } }]);
  }

  function save() {
    startTransition(async () => {
      setResult(await savePermissionPresetsAction(presets));
    });
  }

  return (
    <div className="space-y-4">
      {presets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-ink-soft">
          Aún no hay plantillas. Crea una para reutilizarla al dar de alta miembros de organización.
        </p>
      ) : null}

      {presets.map((preset, index) => (
        <div key={index} className="rounded-lg border border-line bg-bg p-4">
          <div className="mb-3 flex items-center gap-2">
            <Input
              type="text"
              value={preset.name}
              onChange={(event) => updatePreset(index, { name: event.target.value })}
              placeholder="Nombre de la plantilla (p. ej. Practicante universitario)"
              className="max-w-sm font-medium"
            />
            <button
              type="button"
              onClick={() => removePreset(index)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft"
            >
              <Trash2 size={13} />
              Eliminar
            </button>
          </div>
          <PermissionsEditor
            value={preset.permissions}
            onChange={(permissions) => updatePreset(index, { permissions })}
            prefix={`preset_${index}_`}
          />
        </div>
      ))}

      {result?.error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{result.error}</p> : null}
      {result?.ok ? <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{result.ok}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={addPreset}>
          <Plus size={15} />
          Añadir plantilla
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          <Save size={15} />
          {pending ? 'Guardando…' : 'Guardar plantillas'}
        </Button>
      </div>
    </div>
  );
}
