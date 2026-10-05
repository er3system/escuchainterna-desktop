'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Textarea } from '@/components/ui';
import type { PatientNote } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository';
import { addPatientNoteAction, deletePatientNoteAction } from './actions';

/**
 * Bitácora de notas privadas del paciente: apuntes sueltos del psicólogo que NO
 * entran al expediente firmable. Lista con fecha + composer inline + borrar.
 * En cobertura/compartido (readOnly) se ocultan las acciones de escritura.
 */
export function PatientNotesCard({
  patientId,
  notes,
  readOnly = false,
}: {
  patientId: string;
  notes: PatientNote[];
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();

  function add() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addPatientNoteAction(patientId, text);
      if (result.ok) setDraft('');
    });
  }

  function remove(noteId: string) {
    startTransition(async () => {
      await deletePatientNoteAction(patientId, noteId);
    });
  }

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
        <NotebookPen size={15} className="text-ink-soft" /> Notas
      </h3>
      <p className="mb-3 text-xs text-ink-soft">
        Apuntes privados sobre el paciente. No entran al expediente firmable.
      </p>

      {!readOnly ? (
        <div className="mb-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Anota algo de este paciente…"
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || draft.trim() === ''}
            onClick={add}
            className="mt-2 disabled:opacity-50"
          >
            <Plus size={13} /> Agregar nota
          </Button>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="text-sm text-ink-soft">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-line bg-bg/50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(note.id)}
                    aria-label="Borrar nota"
                    className="shrink-0 rounded p-1 text-ink-soft transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                {format(new Date(note.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
