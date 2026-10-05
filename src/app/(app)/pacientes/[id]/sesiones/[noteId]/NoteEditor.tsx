'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Loader2, Save, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { polishNoteAction, updateNoteAction } from '../actions';

export function NoteEditor({
  noteId,
  patientId,
  initialTitle,
  initialContent,
  createdAt,
}: {
  noteId: string;
  patientId: string;
  initialTitle: string;
  initialContent: string;
  createdAt: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [, startTransition] = useTransition();

  // "Pulir con IA": borrador editable; nunca reemplaza el texto sin aprobación.
  const [draft, setDraft] = useState<string | null>(null);
  const [polishError, setPolishError] = useState('');
  const [polishing, startPolish] = useTransition();

  function save() {
    setStatus('saving');
    startTransition(async () => {
      const result = await updateNoteAction(noteId, patientId, title, content);
      if (result.ok) {
        setStatus('saved');
      } else {
        setStatus('error');
        setErrorMessage(result.error ?? 'No se pudo guardar la nota.');
      }
    });
  }

  function polish() {
    setPolishError('');
    setDraft(null);
    startPolish(async () => {
      const result = await polishNoteAction(noteId, patientId);
      if (result.ok) setDraft(result.draft);
      else setPolishError(result.error);
    });
  }

  function applyDraft() {
    if (draft === null) return;
    setContent(draft);
    setStatus('dirty');
    setDraft(null);
  }

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setStatus('dirty');
            }}
            onBlur={() => {
              if (status === 'dirty') save();
            }}
            placeholder="Título de la sesión"
            title="Haz clic para cambiar el título de la sesión"
            className="-ml-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-bold text-ink transition hover:border-line focus:border-primary focus:bg-bg focus:outline-none"
            aria-label="Título de la sesión (editable)"
          />
          <p className="text-xs text-ink-soft">
            Creada el {format(new Date(createdAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-soft" aria-live="polite">
            {status === 'saving' ? 'Guardando…' : null}
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check size={13} /> Guardado
              </span>
            ) : null}
            {status === 'dirty' ? 'Cambios sin guardar' : null}
            {status === 'error' ? <span className="text-danger">{errorMessage}</span> : null}
          </span>
          <button
            type="button"
            onClick={polish}
            disabled={polishing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-primary dark:text-accent-2 hover:border-primary disabled:opacity-50"
          >
            {polishing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {polishing ? 'Puliendo…' : 'Pulir con IA'}
          </button>
          <Button
            type="button"
            onClick={save}
            disabled={status === 'saving'}
            className="disabled:opacity-50"
          >
            <Save size={15} /> Guardar
          </Button>
        </div>
      </div>

      {polishError ? (
        <p className="border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger">{polishError}</p>
      ) : null}

      {draft !== null ? (
        <div className="border-b border-line bg-primary-light/30 dark:bg-primary/15 p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles size={14} className="text-primary dark:text-accent-2" /> Borrador pulido por IA
            </p>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg p-1 text-ink-soft hover:bg-bg hover:text-ink"
              aria-label="Cerrar borrador"
            >
              <X size={15} />
            </button>
          </div>
          <p className="mb-2 text-xs text-ink-soft">
            Revisa el borrador. Reemplaza tu texto solo si te convence — no se guarda solo.
          </p>
          <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
            {draft}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={applyDraft}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Check size={14} /> Reemplazar texto
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:border-primary hover:text-primary dark:hover:text-accent-2"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setStatus('dirty');
        }}
        onBlur={() => {
          if (status === 'dirty') save();
        }}
        placeholder="Escribe aquí las notas de la sesión…"
        className="block min-h-[28rem] w-full resize-y rounded-b-card border-none bg-surface p-5 text-sm leading-relaxed text-ink focus:outline-none"
      />
    </div>
  );
}
