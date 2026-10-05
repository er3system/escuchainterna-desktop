'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { allPatientGenders } from '@/contexts/patients/domain/value-objects/genderLabels';

/** Claves de filtro que viven en la query (además de `q`). */
const FILTER_KEYS = ['archivados', 'etiqueta', 'genero', 'diagnostico', 'ultima', 'proxima'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const SELECT_CLASS =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary';

export function PatientFilters({
  knownTags,
  resultCount,
  showDiagnosis,
}: {
  /** Etiquetas distintas del profesional (derivadas de tags_json). */
  knownTags: string[];
  /** N pacientes del resultado actual (lo calcula el server). */
  resultCount: number;
  /** El rol asistente no ve diagnósticos: ocultamos ese filtro (v3 §4). */
  showDiagnosis: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const archivados = searchParams.get('archivados') ?? 'activos';
  const etiqueta = searchParams.get('etiqueta') ?? '';
  const genero = searchParams.get('genero') ?? '';
  const diagnostico = searchParams.get('diagnostico') ?? 'todos';
  const ultima = searchParams.get('ultima') ?? 'todos';
  const proxima = searchParams.get('proxima') ?? 'todos';

  const [text, setText] = useState(searchParams.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  // Si la query cambia desde fuera (p. ej. botón limpiar), refleja el texto.
  useEffect(() => {
    setText(searchParams.get('q') ?? '');
  }, [searchParams]);

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const onTextChange = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value.trim() || null }), 350);
  };

  const activeFilterCount = FILTER_KEYS.reduce((count, key) => {
    const value = searchParams.get(key);
    if (!value) return count;
    if (key === 'archivados' && value === 'activos') return count;
    if ((key === 'diagnostico' || key === 'ultima' || key === 'proxima') && value === 'todos')
      return count;
    return count + 1;
  }, 0);
  const hasAnyFilter = activeFilterCount > 0 || text.trim().length > 0;

  const clearAll = () => {
    if (debounce.current) clearTimeout(debounce.current);
    setText('');
    router.replace(pathname);
  };

  const removeFilter = (key: FilterKey) => {
    const reset: Record<string, string | null> = { [key]: null };
    apply(reset);
  };

  const genderLabel = (value: string) =>
    allPatientGenders().find((g) => g.value === value)?.label ?? value;

  const ARCHIVED_LABELS: Record<string, string> = {
    activos: 'Activos',
    archivados: 'Archivados',
    todos: 'Todos',
  };
  const DIAGNOSIS_LABELS: Record<string, string> = {
    con: 'Con diagnóstico activo',
    sin: 'Sin diagnóstico',
  };
  const LAST_SESSION_LABELS: Record<string, string> = {
    sin: 'Sin sesiones',
    mas_3_meses: 'Última sesión hace +3 meses',
    mas_6_meses: 'Última sesión hace +6 meses',
    este_mes: 'Con sesión este mes',
  };
  const NEXT_LABELS: Record<string, string> = {
    con: 'Con próxima cita',
    sin: 'Sin próxima cita',
  };

  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="search"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Buscar por nombre, correo, teléfono o documento"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
          />
        </div>

        {/* Toggle del panel (siempre visible; en móvil es el control principal). */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            open || activeFilterCount > 0
              ? 'border-primary bg-primary-light text-primary'
              : 'border-line bg-surface text-ink-soft hover:bg-bg'
          }`}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <span className="text-sm font-medium text-ink-soft">
          {resultCount} {resultCount === 1 ? 'paciente' : 'pacientes'}
        </span>
      </div>

      {/* Panel de filtros: colapsable en móvil (hidden), siempre visible en md+. */}
      <div className={`${open ? 'grid' : 'hidden'} mt-4 gap-3 md:grid md:grid-cols-2 lg:grid-cols-3`}>
        <FilterField label="Estado">
          <select
            value={archivados}
            onChange={(event) => apply({ archivados: event.target.value === 'activos' ? null : event.target.value })}
            className={SELECT_CLASS}
          >
            <option value="activos">Activos</option>
            <option value="archivados">Archivados</option>
            <option value="todos">Todos</option>
          </select>
        </FilterField>

        <FilterField label="Etiqueta">
          <select
            value={etiqueta}
            onChange={(event) => apply({ etiqueta: event.target.value || null })}
            className={SELECT_CLASS}
            disabled={knownTags.length === 0}
          >
            <option value="">Todas las etiquetas</option>
            {knownTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Género">
          <select
            value={genero}
            onChange={(event) => apply({ genero: event.target.value || null })}
            className={SELECT_CLASS}
          >
            <option value="">Todos</option>
            {allPatientGenders().map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </FilterField>

        {showDiagnosis ? (
          <FilterField label="Diagnóstico">
            <select
              value={diagnostico}
              onChange={(event) => apply({ diagnostico: event.target.value === 'todos' ? null : event.target.value })}
              className={SELECT_CLASS}
            >
              <option value="todos">Todos</option>
              <option value="con">Con diagnóstico activo</option>
              <option value="sin">Sin diagnóstico</option>
            </select>
          </FilterField>
        ) : null}

        <FilterField label="Última sesión">
          <select
            value={ultima}
            onChange={(event) => apply({ ultima: event.target.value === 'todos' ? null : event.target.value })}
            className={SELECT_CLASS}
          >
            <option value="todos">Cualquiera</option>
            <option value="sin">Sin sesiones</option>
            <option value="este_mes">Este mes</option>
            <option value="mas_3_meses">Hace más de 3 meses</option>
            <option value="mas_6_meses">Hace más de 6 meses</option>
          </select>
        </FilterField>

        <FilterField label="Próxima cita">
          <select
            value={proxima}
            onChange={(event) => apply({ proxima: event.target.value === 'todos' ? null : event.target.value })}
            className={SELECT_CLASS}
          >
            <option value="todos">Cualquiera</option>
            <option value="con">Con cita futura</option>
            <option value="sin">Sin próxima cita</option>
          </select>
        </FilterField>
      </div>

      {hasAnyFilter ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
            <Filter size={13} />
            Activos:
          </span>
          {archivados !== 'activos' ? (
            <Chip onRemove={() => removeFilter('archivados')}>{ARCHIVED_LABELS[archivados]}</Chip>
          ) : null}
          {etiqueta ? <Chip onRemove={() => removeFilter('etiqueta')}>#{etiqueta}</Chip> : null}
          {genero ? <Chip onRemove={() => removeFilter('genero')}>{genderLabel(genero)}</Chip> : null}
          {showDiagnosis && diagnostico !== 'todos' ? (
            <Chip onRemove={() => removeFilter('diagnostico')}>{DIAGNOSIS_LABELS[diagnostico]}</Chip>
          ) : null}
          {ultima !== 'todos' ? (
            <Chip onRemove={() => removeFilter('ultima')}>{LAST_SESSION_LABELS[ultima]}</Chip>
          ) : null}
          {proxima !== 'todos' ? (
            <Chip onRemove={() => removeFilter('proxima')}>{NEXT_LABELS[proxima]}</Chip>
          ) : null}
          {text.trim() ? (
            <Chip onRemove={() => { setText(''); apply({ q: null }); }}>«{text.trim()}»</Chip>
          ) : null}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-sm font-medium text-primary hover:underline dark:text-accent-2"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
      {label}
      {children}
    </label>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar filtro"
        className="ml-0.5 inline-flex rounded-full transition hover:text-primary-dark"
      >
        <X size={12} />
      </button>
    </span>
  );
}
