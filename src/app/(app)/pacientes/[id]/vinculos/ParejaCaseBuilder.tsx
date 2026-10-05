'use client';

import { useMemo, useState } from 'react';
import { HeartHandshake, Search, UserPlus } from 'lucide-react';
import { createParejaCaseAction } from './actions';
import { QuickCreatePatient } from '@/components/patients/QuickCreatePatient';
import { PersonCard, initials } from './PersonCard';
import { normalizeForSearch } from '@/components/patients/patientSearch';
import { Button, Input } from '@/components/ui';

interface PickPatient {
  id: string;
  fullName: string;
}

/**
 * Constructor visual del caso de PAREJA: muestra a las dos personas como dos
 * caras unidas por un vínculo (♥), con el paciente actual fijo a la izquierda y
 * la pareja por elegir/crear a la derecha. Más intuitivo que un buscador suelto:
 * se "ve" cómo se forma la pareja. Conserva la server action existente
 * (createParejaCaseAction lee secondPatientId) sin cambios.
 */
export function ParejaCaseBuilder({
  patientId,
  currentName,
  patients,
}: {
  patientId: string;
  currentName: string;
  patients: PickPatient[];
}) {
  const [partner, setPartner] = useState<PickPatient | null>(null);
  const [extra, setExtra] = useState<PickPatient[]>([]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const merged: PickPatient[] = [];
    for (const patient of [...patients, ...extra]) {
      if (seen.has(patient.id)) continue;
      seen.add(patient.id);
      merged.push(patient);
    }
    return merged.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }, [patients, extra]);

  const matches = useMemo(() => {
    const q = normalizeForSearch(query);
    const filtered = q ? pool.filter((p) => normalizeForSearch(p.fullName).includes(q)) : pool;
    return filtered.slice(0, 6);
  }, [pool, query]);

  function choose(patient: PickPatient) {
    setPartner(patient);
    setQuery('');
    setShowCreate(false);
  }

  function handleCreated(patient: PickPatient) {
    setExtra((prev) => (prev.some((p) => p.id === patient.id) ? prev : [...prev, patient]));
    choose(patient);
  }

  return (
    <form action={createParejaCaseAction.bind(null, patientId)} className="mt-4 space-y-4">
      <input type="hidden" name="secondPatientId" value={partner?.id ?? ''} />

      {/* Las dos caras de la pareja, unidas por el vínculo */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex-1">
          <PersonCard name={currentName} role="Tu paciente" />
        </div>

        <span className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary sm:mx-0">
          <HeartHandshake size={18} />
        </span>

        {partner ? (
          <div className="flex-1">
            <PersonCard name={partner.fullName} role="Pareja" onRemove={() => setPartner(null)} removeLabel="Cambiar" />
          </div>
        ) : (
          <div className="flex-1 rounded-card border border-dashed border-line bg-bg/40 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Elige o busca a la pareja…"
                className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            {matches.length > 0 ? (
              <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto overflow-hidden rounded-lg border border-line bg-surface">
                {matches.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => choose(patient)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition hover:bg-primary-light/50 dark:hover:bg-primary/20"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-[11px] font-semibold text-ink-soft">
                        {initials(patient.fullName)}
                      </span>
                      {patient.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : pool.length === 0 ? (
              <p className="mt-2 text-xs text-ink-soft">
                Aún no tienes otro paciente. Crea su perfil rápido aquí abajo.
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink-soft">Sin coincidencias para «{query}».</p>
            )}

            {showCreate ? (
              <QuickCreatePatient onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition hover:underline dark:text-accent-2"
              >
                <UserPlus size={14} /> Crear perfil rápido
              </button>
            )}
          </div>
        )}
      </div>

      {/* Título opcional + crear */}
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Título del caso (opcional)</label>
        <Input
          type="text"
          name="title"
          placeholder={partner ? `${currentName} y ${partner.fullName}` : `p. ej. ${currentName} y su pareja`}
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={!partner}
          className="disabled:opacity-50"
        >
          <HeartHandshake size={16} /> Crear caso de pareja
        </Button>
        {!partner ? <span className="text-xs text-ink-soft">Elige a la pareja para continuar.</span> : null}
      </div>
    </form>
  );
}
