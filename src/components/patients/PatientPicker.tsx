'use client';

import { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { QuickCreatePatient } from './QuickCreatePatient';
import { normalizeForSearch } from './patientSearch';

interface PickPatient {
  id: string;
  fullName: string;
}

/**
 * Selector de pacientes con BÚSQUEDA (no un <select> simple): pensado para consultas
 * con cientos de pacientes. `mode='single'` elige uno; `mode='multi'` elige varios.
 * Aporta inputs ocultos con `name={fieldName}` al formulario que lo contiene, de modo
 * que las server actions existentes (secondPatientId / memberIds / newPatientId) no
 * cambian. Incluye "crear perfil rápido": el paciente nuevo se añade y se preselecciona.
 */
export function PatientPicker({
  patients,
  mode,
  fieldName,
  placeholder = 'Busca un paciente por nombre…',
  emptyHint,
  defaultSelectedIds = [],
}: {
  patients: PickPatient[];
  mode: 'single' | 'multi';
  fieldName: string;
  placeholder?: string;
  emptyHint?: string;
  /** Preselección inicial (p. ej. el paciente del expediente desde el que se abre). */
  defaultSelectedIds?: string[];
}) {
  const [extra, setExtra] = useState<PickPatient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    mode === 'single' ? defaultSelectedIds.slice(0, 1) : defaultSelectedIds,
  );
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Pool = pacientes del servidor + creados al vuelo (dedup por id).
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

  const nameById = useMemo(() => new Map(pool.map((p) => [p.id, p.fullName])), [pool]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const matches = useMemo(() => {
    const q = normalizeForSearch(query);
    const base = pool.filter((p) => !selectedSet.has(p.id));
    const filtered = q ? base.filter((p) => normalizeForSearch(p.fullName).includes(q)) : base;
    return filtered.slice(0, 8);
  }, [pool, query, selectedSet]);

  function select(id: string) {
    setSelectedIds((prev) => (mode === 'single' ? [id] : prev.includes(id) ? prev : [...prev, id]));
    setQuery('');
  }

  function deselect(id: string) {
    setSelectedIds((prev) => prev.filter((value) => value !== id));
  }

  function handleCreated(patient: PickPatient) {
    setExtra((prev) => (prev.some((p) => p.id === patient.id) ? prev : [...prev, patient]));
    setSelectedIds((prev) => (mode === 'single' ? [patient.id] : [...prev, patient.id]));
    setShowCreate(false);
    setQuery('');
  }

  const totalMatching = pool.filter((p) => !selectedSet.has(p.id)).length;

  return (
    <div className="space-y-2">
      {/* Inputs ocultos para el formulario contenedor */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={fieldName} value={id} />
      ))}

      {/* Seleccionados (chips) */}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary"
            >
              {nameById.get(id) ?? 'Paciente'}
              <button
                type="button"
                onClick={() => deselect(id)}
                className="rounded-full p-0.5 transition hover:bg-primary/15"
                aria-label={`Quitar ${nameById.get(id) ?? 'paciente'}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Buscador (en modo single, se oculta cuando ya hay uno elegido) */}
      {mode === 'single' && selectedIds.length > 0 ? null : (
        <>
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          {pool.length === 0 ? (
            <p className="text-xs text-ink-soft">
              {emptyHint ?? 'Aún no tienes otros pacientes. Crea uno rápido aquí abajo.'}
            </p>
          ) : matches.length > 0 ? (
            <ul className="max-w-sm divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {matches.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => select(patient.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition hover:bg-bg"
                  >
                    <UserPlus size={13} className="shrink-0 text-ink-soft" />
                    {patient.fullName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-soft">Sin coincidencias para «{query}».</p>
          )}

          {totalMatching > matches.length ? (
            <p className="text-xs text-ink-soft">
              Mostrando {matches.length} de {totalMatching}. Escribe para afinar la búsqueda.
            </p>
          ) : null}
        </>
      )}

      {/* Crear perfil rápido */}
      {showCreate ? (
        <QuickCreatePatient onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary dark:text-accent-2 transition hover:underline"
        >
          <UserPlus size={14} /> Crear perfil rápido
        </button>
      )}
    </div>
  );
}
