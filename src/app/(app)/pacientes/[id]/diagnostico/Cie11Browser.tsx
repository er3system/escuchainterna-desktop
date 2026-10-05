'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react';
import type { Cie11Entry } from '@/contexts/clinical-records/domain/repositories/Cie11Catalog';
import { Button, Textarea } from '@/components/ui';
import { childrenOfAction, registerDiagnosisAction, searchCie11Action } from './actions';

const CHAPTERS = [
  { chapter: '06', title: 'Trastornos mentales, del comportamiento y del neurodesarrollo' },
  { chapter: '07', title: 'Trastornos del ciclo sueño-vigilia' },
  { chapter: '17', title: 'Condiciones relacionadas con la salud sexual' },
];

function TreeNode({
  entry,
  onSelect,
}: {
  entry: Cie11Entry;
  onSelect: (entry: Cie11Entry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Cie11Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null && !loading) {
      setLoading(true);
      try {
        const loaded = await childrenOfAction(entry.code, entry.chapter);
        setChildren(loaded);
      } finally {
        setLoading(false);
      }
    }
  }

  const isLeaf = children !== null && children.length === 0;

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-bg">
        <button
          type="button"
          onClick={toggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-soft"
          aria-label={expanded ? 'Contraer' : 'Expandir'}
          aria-expanded={expanded}
        >
          {isLeaf ? (
            <span className="inline-block h-1 w-1 rounded-full bg-line" />
          ) : expanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
        <span className="font-mono text-xs text-ink-soft">{entry.code}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.title}</span>
        <button
          type="button"
          onClick={() => onSelect(entry)}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-light px-2 py-0.5 text-xs font-medium text-primary"
        >
          <Plus size={12} /> Asignar
        </button>
      </div>
      {expanded ? (
        <div className="ml-5 border-l border-line pl-2">
          {loading ? <p className="px-2 py-1 text-xs text-ink-soft">Cargando…</p> : null}
          {(children ?? []).map((child) => (
            <TreeNode key={child.code} entry={child} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Cie11Browser({ patientId }: { patientId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cie11Entry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Record<string, Cie11Entry[]>>({});
  const [searching, setSearching] = useState(false);
  const [roots, setRoots] = useState<Record<string, Cie11Entry[]>>({});
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Cie11Entry | null>(null);
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setBreadcrumbs({});
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchCie11Action(text);
        setResults(found.results);
        setBreadcrumbs(found.breadcrumbs);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function toggleChapter(chapter: string) {
    const open = !openChapters[chapter];
    setOpenChapters((previous) => ({ ...previous, [chapter]: open }));
    if (open && !roots[chapter]) {
      let loaded: Cie11Entry[] = [];
      try {
        loaded = await childrenOfAction(null, chapter);
      } finally {
        setRoots((previous) => ({ ...previous, [chapter]: loaded }));
      }
    }
  }

  function select(entry: Cie11Entry) {
    setSelected(entry);
    setFeedback(null);
  }

  function register() {
    if (!selected || pending) return;
    startTransition(async () => {
      const result = await registerDiagnosisAction(patientId, selected.code, notes);
      if (result.ok) {
        setFeedback({ kind: 'ok', text: `Diagnóstico ${selected.code} registrado.` });
        setSelected(null);
        setNotes('');
      } else {
        setFeedback({ kind: 'error', text: result.error ?? 'No se pudo registrar.' });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Buscar diagnóstico CIE-11"
            placeholder="Buscar por código o nombre… (ej. 6B00, ansiedad)"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>
        {searching ? <p className="mt-2 text-xs text-ink-soft">Buscando…</p> : null}
        {!searching && query.trim().length >= 2 && results.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Sin resultados para “{query.trim()}”.</p>
        ) : null}
        {results.length > 0 ? (
          <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
            {results.map((entry) => (
              <li key={entry.code} className="group flex items-center gap-2 px-1 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary dark:text-accent-2">{entry.code}</span>
                    <span className="truncate text-sm font-medium text-ink">{entry.title}</span>
                  </div>
                  {(breadcrumbs[entry.code] ?? []).length > 0 ? (
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {(breadcrumbs[entry.code] ?? []).map((ancestor) => ancestor.title).join(' › ')}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => select(entry)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-light px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                >
                  <Plus size={12} /> Asignar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Formulario de asignación */}
      {selected ? (
        <div className="rounded-card border border-primary bg-primary-light/40 p-4 dark:border-accent-2/25 dark:bg-primary/15">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                <span className="mr-2 font-mono text-primary dark:text-accent-2">{selected.code}</span>
                {selected.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-ink-soft hover:text-ink"
              aria-label="Quitar selección"
            >
              <X size={16} />
            </button>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Especificadores o notas del diagnóstico (opcional)…"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={register}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              <Check size={15} /> {pending ? 'Guardando…' : 'Guardar diagnóstico'}
            </button>
          </div>
        </div>
      ) : null}
      {feedback ? (
        <p className={`text-sm ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}>{feedback.text}</p>
      ) : null}

      {/* Navegador jerárquico */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h3 className="mb-2 text-sm font-bold text-ink">Explorar por capítulo</h3>
        <div className="space-y-1">
          {CHAPTERS.map(({ chapter, title }) => (
            <div key={chapter}>
              <button
                type="button"
                onClick={() => toggleChapter(chapter)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-bg"
                aria-expanded={!!openChapters[chapter]}
              >
                {openChapters[chapter] ? (
                  <ChevronDown size={14} className="text-ink-soft" />
                ) : (
                  <ChevronRight size={14} className="text-ink-soft" />
                )}
                <span className="font-mono text-xs text-ink-soft">{chapter}</span>
                <span className="text-sm font-semibold text-ink">{title}</span>
              </button>
              {openChapters[chapter] ? (
                <div className="ml-5 border-l border-line pl-2">
                  {!roots[chapter] ? <p className="px-2 py-1 text-xs text-ink-soft">Cargando…</p> : null}
                  {(roots[chapter] ?? []).map((entry) => (
                    <TreeNode key={entry.code} entry={entry} onSelect={select} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
