'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { ACCESS_POLICIES, type AccessPolicy } from '@/contexts/identity/domain/value-objects/accessPolicy';
import { setAccessPolicyAction, setProfessorCanWidenAction } from '../actions';

/**
 * Configuración del acceso entre miembros (cuentas institucionales §2). La
 * institución fija el preset; opcionalmente permite que el profesor lo amplíe para
 * sus supervisados. Todo acceso a un expediente no asignado se traza como
 * "acceso de cobertura" (habeas data). Solo se muestra en cuentas institucionales.
 */
export function AccessPolicyControl({
  initialPolicy,
  initialProfessorCanWiden,
}: {
  initialPolicy: AccessPolicy;
  initialProfessorCanWiden: boolean;
}) {
  const [policy, setPolicy] = useState<AccessPolicy>(initialPolicy);
  const [canWiden, setCanWiden] = useState(initialProfessorCanWiden);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changePolicy = (next: AccessPolicy) => {
    setError(null);
    const previous = policy;
    setPolicy(next);
    startTransition(async () => {
      const result = await setAccessPolicyAction(next);
      if (result.error) {
        setPolicy(previous);
        setError(result.error);
      }
    });
  };

  const toggleWiden = (next: boolean) => {
    setError(null);
    setCanWiden(next);
    startTransition(async () => {
      const result = await setProfessorCanWidenAction(next);
      if (result.error) {
        setCanWiden(!next);
        setError(result.error);
      }
    });
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <ShieldCheck size={18} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Acceso entre miembros</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Quién puede abrir los expedientes de la organización. Todo acceso a un expediente no
            asignado queda registrado en la bitácora (acceso de cobertura).
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {ACCESS_POLICIES.map((preset) => (
          <label
            key={preset.key}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
              policy === preset.key ? 'border-primary bg-primary-light/40 dark:bg-primary/15' : 'border-line hover:border-primary/40'
            }`}
          >
            <input
              type="radio"
              name="access_policy"
              value={preset.key}
              checked={policy === preset.key}
              onChange={() => changePolicy(preset.key)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{preset.label}</span>
              <span className="block text-xs text-ink-soft">{preset.description}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-4 opacity-70">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            El profesor puede ampliar el acceso
            <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              Próximamente
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Permitirá que cada profesor amplíe la visibilidad para sus supervisados, sin bajar de la
            base de la institución. Aún no está activo: hoy siempre rige la política de la institución.
          </p>
        </div>
        <Switch
          checked={canWiden}
          onChange={toggleWiden}
          label="El profesor puede ampliar el acceso de sus supervisados (próximamente)"
          disabled
        />
      </div>

      {error ? <p className="mt-2 text-sm font-medium text-danger">{error}</p> : null}
      {pending ? <p className="mt-2 text-xs text-ink-soft">Guardando…</p> : null}
    </div>
  );
}
