'use client';

import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { Answers } from '@/components/clinical/FieldControl';
import { SectionsEditor } from '@/components/clinical/SectionsEditor';
import { NoteEditor } from './NoteEditor';
import {
  addSessionBlockAction,
  removeSessionBlockAction,
  saveSessionAnswersAction,
} from '../actions';

/**
 * Editor completo de una sesión: el texto libre (NoteEditor) más el formulario
 * estructurado de su plantilla (1ª/seguimiento) y los BLOQUES curados que se le
 * añaden (P6.2). Reusa SectionsEditor con las acciones de sesión y el contexto
 * 'sesion' (el catálogo se filtra a los bloques añadibles a una sesión).
 */
export function SessionEditor({
  noteId,
  patientId,
  structuredTitle,
  structuredDescription,
  sections,
  initialAnswers,
  initialTitle,
  initialContent,
  createdAt,
  compact = false,
}: {
  noteId: string;
  patientId: string;
  structuredTitle: string;
  structuredDescription: string;
  sections: ClinicalSection[];
  initialAnswers: Answers;
  initialTitle: string;
  initialContent: string;
  createdAt: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <NoteEditor
        noteId={noteId}
        patientId={patientId}
        initialTitle={initialTitle}
        initialContent={initialContent}
        createdAt={createdAt}
      />
      <SectionsEditor
        entityId={noteId}
        patientId={patientId}
        title={structuredTitle}
        description={structuredDescription}
        sections={sections}
        initialAnswers={initialAnswers}
        saveAction={saveSessionAnswersAction}
        enableBlocks
        addBlockAction={addSessionBlockAction}
        removeBlockAction={removeSessionBlockAction}
        blockContext="sesion"
        addBlockLabel="Añadir bloque a la sesión"
        compact={compact}
      />
    </div>
  );
}
