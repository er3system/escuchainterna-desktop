'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { createFamiliaCaseAction } from './actions';
import { QuickCreatePatient } from '@/components/patients/QuickCreatePatient';
import { PersonCard, initials } from './PersonCard';
import { normalizeForSearch } from '@/components/patients/patientSearch';
import { Button, Input } from '@/components/ui';

interface PickPatient {
  id: string;
  fullName: string;
}

/**
 * Constructor visual del caso de FAMILIA: el sistema se "arma" como una fila de
 * tarjetas-persona (el paciente actual fijo + cada familiar añadido) con un mosaico
 * "+ Agregar familiar" que abre la búsqueda/alta rápida. Conserva la server action
 * existente (createFamiliaCaseAction lee memberIds[]) sin cambios.
 */
export function FamiliaCaseBuilder({
  patientId,
  currentName,
  patients,
}: {
  patientId: string;
  currentName: string;
  patients: PickPatient[];
}) {
  const [selected, setSelected] = useState<PickPatient[]>([]);
  const [extra, setExtra] = useState<PickPatient[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

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
    const base = pool.filter((p) => !selectedIds.has(p.id));
    const filtered = q ? base.filter((p) => normalizeForSearch(p.fullName).includes(q)) : base;
    return filtered.slice(0, 6);
  }, [pool, query, selectedIds]);

  function add(patient: PickPatient) {
    setSelected((prev) => (prev.some((p) => p.id === patient.id) ? prev : [...prev, patient]));
    setQuery('');
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreated(patient: PickPatient) {
    setExtra((prev) => (prev.some((p) => p.id === patient.id) ? prev : [...prev, patient]));
    add(patient);
    setShowCreate(false);
  }

  return (
    <form action={createFamiliaCaseAction.bind(null, patientId)} className="mt-4 space-y-4">
      {selected.map((member) => (
        <input key={member.id} type="hidden" name="memberIds" value={member.id} />
      ))}

      {/* El sistema familiar como tarjetas-persona */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div>
          <PersonCard name={currentName} role="Tu paciente" />
        </div>
        {selected.map((member) => (
          <div key={member.id}>
            <PersonCard name={member.fullName} role="Familiar" onRemove={() => remove(member.id)} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          className={`flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-card border border-dashed p-4 text-center transition ${
            adding
              ? 'border-primary bg-primary-light/40 dark:bg-primary/15 text-primary dark:text-accent-2'
              : 'border-line text-ink-soft hover:border-primary hover:text-primary dark:hover:text-accent-2'
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg">
            <Plus size={20} />
          </span>
          <span className="text-sm font-medium">Agregar familiar</span>
        </button>
      </div>

      {/* Panel de búsqueda / alta rápida */}
      {adding ? (
        <div className="rounded-card border border-dashed border-line bg-bg/40 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca familiares por nombre…"
              className="w-full max-w-sm rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          {matches.length > 0 ? (
            <ul className="mt-2 max-w-sm divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {matches.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => add(patient)}
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
          ) : pool.filter((p) => !selectedIds.has(p.id)).length === 0 ? (
            <p className="mt-2 text-xs text-ink-soft">
              No tienes más pacientes para añadir. Crea su perfil rápido aquí abajo.
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
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary dark:text-accent-2 transition hover:underline"
            >
              <UserPlus size={14} /> Crear perfil rápido
            </button>
          )}
        </div>
      ) : null}

      {/* Título opcional + crear */}
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Título del caso (opcional)</label>
        <Input
          type="text"
          name="title"
          placeholder={`p. ej. Familia de ${currentName}`}
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={selected.length === 0}
          className="disabled:opacity-50"
        >
          <Users size={16} /> Crear caso de familia
        </Button>
        {selected.length === 0 ? (
          <span className="text-xs text-ink-soft">Agrega al menos un familiar para continuar.</span>
        ) : (
          <span className="text-xs text-ink-soft">
            {selected.length + 1} {selected.length + 1 === 1 ? 'persona' : 'personas'} en el caso.
          </span>
        )}
      </div>
    </form>
  );
}
