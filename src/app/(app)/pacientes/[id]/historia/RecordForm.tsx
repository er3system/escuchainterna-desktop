'use client';

import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { Answers } from '@/components/clinical/FieldControl';
import { SectionsEditor } from '@/components/clinical/SectionsEditor';
import { addHistoriaBlockAction, removeHistoriaBlockAction, saveRecordAnswersAction } from './actions';

/**
 * Editor del DOCUMENTO consolidado (núcleo + bloques de la historia primaria).
 * Es una fachada sobre SectionsEditor con las acciones de la historia y el
 * contexto 'nucleo' (el catálogo se filtra a los bloques añadibles al núcleo).
 */
export function RecordForm({
  recordId,
  patientId,
  title,
  description,
  sections,
  initialAnswers,
  enableBlocks = false,
}: {
  recordId: string;
  patientId: string;
  title: string;
  description: string;
  sections: ClinicalSection[];
  initialAnswers: Answers;
  enableBlocks?: boolean;
}) {
  return (
    <SectionsEditor
      entityId={recordId}
      patientId={patientId}
      title={title}
      description={description}
      sections={sections}
      initialAnswers={initialAnswers}
      saveAction={saveRecordAnswersAction}
      enableBlocks={enableBlocks}
      addBlockAction={addHistoriaBlockAction}
      removeBlockAction={removeHistoriaBlockAction}
      blockContext="nucleo"
      addBlockLabel="Añadir bloque a la historia"
    />
  );
}
