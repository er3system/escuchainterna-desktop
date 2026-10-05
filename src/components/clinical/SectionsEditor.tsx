'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type {
  ClinicalField,
  ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import { FieldControl, isAnswered, type AnswerValue, type Answers } from '@/components/clinical/FieldControl';
import {
  HISTORIA_NUCLEO_TEMPLATE_ID,
  historiaBlockCategories,
  searchHistoriaBlocks,
  type BlockAddableIn,
} from '@/contexts/clinical-records/domain/historiaBlocks';
import { MODEL_DESCRIPTORS } from '@/contexts/clinical-records/domain/modelKeys';

const PASTELS = ['#F9D7DC', '#D5F0D9', '#CDE6F9', '#E3D7F5', '#FCF3C8', '#FBE3C0'];

type Result = { ok: boolean; error?: string };
export type SaveSectionsAction = (entityId: string, patientId: string, answers: Answers) => Promise<Result>;
export type AddBlockAction = (entityId: string, patientId: string, blockId: string) => Promise<Result>;
export type RemoveBlockAction = (entityId: string, patientId: string, sectionId: string) => Promise<Result>;

/** ¿La sección es un bloque añadido (id namespaced) y no parte del núcleo/plantilla base? */
function isAddedBlock(sectionId: string): boolean {
  return sectionId.includes(':');
}

/**
 * Id de catálogo equivalente de una sección presente, para no volver a ofrecerla:
 * los bloques añadidos ya traen su id namespaced; las secciones de núcleo/plantilla
 * (id simple) se mapean a `${HISTORIA_NUCLEO_TEMPLATE_ID}:${id}` (que no coincide con
 * ningún `bloque:<x>`, así que nunca excluyen un bloque del catálogo por error).
 */
function catalogIdOf(sectionId: string): string {
  return isAddedBlock(sectionId) ? sectionId : `${HISTORIA_NUCLEO_TEMPLATE_ID}:${sectionId}`;
}

/** Control "Añadir bloque": desplegable de categoría + buscador sobre el catálogo. */
function BlockPicker({
  entityId,
  patientId,
  presentIds,
  context,
  label,
  addBlockAction,
}: {
  entityId: string;
  patientId: string;
  presentIds: Set<string>;
  context?: BlockAddableIn;
  label: string;
  addBlockAction: AddBlockAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const categories = useMemo(() => historiaBlockCategories(), []);

  const results = useMemo(
    () => searchHistoriaBlocks(query, category, context).filter((block) => !presentIds.has(block.id)),
    [query, category, context, presentIds],
  );

  function add(blockId: string) {
    setError('');
    startTransition(async () => {
      const result = await addBlockAction(entityId, patientId, blockId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo añadir el bloque.');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-primary/50 dark:border-accent-2/25 bg-primary-light/40 dark:bg-primary/15 px-4 py-3 text-sm font-semibold text-primary dark:text-accent-2 transition-colors hover:bg-primary-light"
      >
        <Plus size={16} /> {label}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-ink">Añadir bloque</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-ink-soft hover:bg-bg hover:text-ink"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        Cada bloque es una pieza curada (evaluación, técnica, proceso o estructura). Búscala por
        categoría o texto y añádela.
      </p>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none sm:w-56"
        >
          <option value="">Todas las categorías</option>
          {categories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            type="text"
            value={query}
            placeholder="Buscar bloque (p. ej. análisis funcional, exposición, riesgo)…"
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            No hay bloques que coincidan{category ? ' en esta categoría' : ''}.
          </p>
        ) : (
          results.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/50 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{block.title}</p>
                <p className="truncate text-xs text-ink-soft">
                  {block.category} · {block.section.fields.length} campos
                  {block.hasContinuation ? ' · con seguimiento' : ''}
                  {block.relevantModels.length > 0
                    ? ` · ${block.relevantModels.map((key) => MODEL_DESCRIPTORS[key].enfoque).join(', ')}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => add(block.id)}
                disabled={pending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Añadir
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Editor genérico de secciones clínicas (núcleo/plantilla + bloques curados),
 * reutilizado por la historia consolidada y por cada sesión. Las acciones de
 * guardar/añadir/quitar bloque se inyectan, así el mismo editor sirve para el
 * ClinicalRecord y para una SessionNote sin acoplarse a ninguno.
 */
export function SectionsEditor({
  entityId,
  patientId,
  title,
  description,
  sections,
  initialAnswers,
  saveAction,
  enableBlocks = false,
  addBlockAction,
  removeBlockAction,
  blockContext,
  addBlockLabel = 'Añadir bloque',
  compact = false,
}: {
  entityId: string;
  patientId: string;
  title: string;
  description: string;
  sections: ClinicalSection[];
  initialAnswers: Answers;
  saveAction: SaveSectionsAction;
  /** Activa el catálogo "Añadir bloque" y el botón "Quitar" en bloques añadidos. */
  enableBlocks?: boolean;
  addBlockAction?: AddBlockAction;
  removeBlockAction?: RemoveBlockAction;
  /** Filtra el catálogo por contexto ('nucleo' para la historia, 'sesion' para una sesión). */
  blockContext?: BlockAddableIn;
  addBlockLabel?: string;
  /** Cabecera más sobria (para el panel lateral de la Evolución). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [removing, startRemoveTransition] = useTransition();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();

  // Plegado de secciones (densidad): muchas piezas hacen el editor muy largo, así
  // que cada sección se puede contraer. Por defecto todas abiertas. Solo UI.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allCollapsed = sections.length > 0 && sections.every((section) => collapsed.has(section.id));
  function toggleCollapse(sectionId: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(sections.map((section) => section.id)));
  }

  const allFields = useMemo(() => sections.flatMap((section) => section.fields), [sections]);
  const answeredCount = allFields.filter((field) => isAnswered(answers[field.id])).length;
  const progress = allFields.length > 0 ? Math.round((answeredCount / allFields.length) * 100) : 0;

  const presentIds = useMemo(() => new Set(sections.map((section) => catalogIdOf(section.id))), [sections]);

  function removeBlock(sectionId: string) {
    if (!removeBlockAction) return;
    startRemoveTransition(async () => {
      const result = await removeBlockAction(entityId, patientId, sectionId);
      if (result.ok) {
        router.refresh();
      } else {
        setStatus('error');
        setErrorMessage(result.error ?? 'No se pudo quitar el bloque.');
      }
    });
  }

  function sectionComplete(section: ClinicalSection): boolean {
    const required = section.fields.filter((field) => field.required);
    const checklist = required.length > 0 ? required : section.fields;
    return checklist.length > 0 && checklist.every((field) => isAnswered(answers[field.id]));
  }

  function setAnswer(fieldId: string, value: AnswerValue) {
    setAnswers((previous) => ({ ...previous, [fieldId]: value }));
    setStatus('idle');
  }

  function persist(fields: ClinicalField[]) {
    const payload: Answers = {};
    for (const field of fields) {
      const value = answers[field.id];
      payload[field.id] = value === undefined ? '' : value;
    }
    setStatus('saving');
    startTransition(async () => {
      const result = await saveAction(entityId, patientId, payload);
      if (result.ok) {
        setStatus('saved');
      } else {
        setStatus('error');
        setErrorMessage(result.error ?? 'No se pudo guardar.');
      }
    });
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Cabecera con acento primario */}
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="h-2.5 bg-primary" />
        <div className={compact ? 'p-4' : 'p-5'}>
          <h2 className={compact ? 'text-base font-bold text-ink' : 'text-xl font-bold text-ink'}>{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
          {allFields.length > 0 ? (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
                <span>
                  {answeredCount} de {allFields.length} preguntas respondidas
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-bg">
                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          {!compact && sections.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#seccion-${section.id}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    sectionComplete(section)
                      ? 'border-success bg-success-soft text-success'
                      : 'border-line bg-surface text-ink-soft hover:text-ink'
                  }`}
                >
                  {sectionComplete(section) ? <Check size={12} /> : null}
                  {index + 1}. {section.title}
                </a>
              ))}
            </div>
          ) : null}
          {sections.length > 1 ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition hover:text-primary dark:hover:text-accent-2"
              >
                {allCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                {allCollapsed ? 'Expandir todo' : 'Contraer todo'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-soft">
          Sin secciones todavía. Usa «{addBlockLabel}» para empezar a estructurar.
        </div>
      ) : null}

      {sections.map((section, sectionIndex) => {
        const open = !collapsed.has(section.id);
        const answeredInSection = section.fields.filter((field) => isAnswered(answers[field.id])).length;
        const complete = sectionComplete(section);
        return (
          <section
            key={section.id}
            id={`seccion-${section.id}`}
            className="rounded-card border border-line bg-surface shadow-card"
            style={{ borderLeft: `4px solid ${PASTELS[sectionIndex % PASTELS.length]}` }}
          >
            <div className={`flex items-start justify-between gap-3 p-5 ${open ? 'border-b border-line' : ''}`}>
              <button
                type="button"
                onClick={() => toggleCollapse(section.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <span className="mt-0.5 shrink-0 text-ink-soft">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-bold text-ink">{section.title}</span>
                    {complete ? <Check size={14} className="shrink-0 text-success" /> : null}
                  </span>
                  {section.description ? (
                    <span className="mt-0.5 block text-sm text-ink-soft">{section.description}</span>
                  ) : null}
                  {!open && section.fields.length > 0 ? (
                    <span className="mt-0.5 block text-xs text-ink-soft">
                      {answeredInSection} de {section.fields.length} respondidas
                    </span>
                  ) : null}
                </span>
              </button>
              {enableBlocks && removeBlockAction && isAddedBlock(section.id) ? (
                <button
                  type="button"
                  onClick={() => removeBlock(section.id)}
                  disabled={removing}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                  title="Quitar este bloque"
                >
                  <Trash2 size={13} /> Quitar
                </button>
              ) : null}
            </div>
            {open ? (
              <div className="space-y-4 p-5">
                {section.fields.map((field) => (
                  <div key={field.id} className="rounded-lg border border-line bg-bg/50 p-4">
                    <label className="mb-2 block text-sm font-semibold text-ink">
                      {field.label}
                      {field.required ? <span className="text-danger"> *</span> : null}
                    </label>
                    {field.helpText ? <p className="mb-2 text-xs text-ink-soft">{field.helpText}</p> : null}
                    <FieldControl
                      field={field}
                      value={answers[field.id]}
                      onChange={(value) => setAnswer(field.id, value)}
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => persist(section.fields)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
                  >
                    <Save size={14} /> Guardar sección
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}

      {enableBlocks && addBlockAction ? (
        <BlockPicker
          entityId={entityId}
          patientId={patientId}
          presentIds={presentIds}
          context={blockContext}
          label={addBlockLabel}
          addBlockAction={addBlockAction}
        />
      ) : null}

      {sections.length > 0 ? (
        <div className="sticky bottom-4 flex items-center justify-between rounded-card border border-line bg-surface p-4 shadow-card">
          <span className="text-sm text-ink-soft" aria-live="polite">
            {status === 'saving' ? 'Guardando…' : null}
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check size={14} /> Guardado
              </span>
            ) : null}
            {status === 'error' ? <span className="text-danger">{errorMessage}</span> : null}
            {status === 'idle' ? 'Los cambios se guardan al pulsar Guardar.' : null}
          </span>
          <Button
            type="button"
            onClick={() => persist(allFields)}
            disabled={status === 'saving'}
            className="disabled:opacity-50"
          >
            <Save size={16} /> Guardar todo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
