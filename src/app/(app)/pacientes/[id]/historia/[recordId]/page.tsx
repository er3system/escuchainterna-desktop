import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Lock } from 'lucide-react';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { BLANK_RECORD_SECTIONS } from '@/contexts/clinical-records/domain/blankRecordSections';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { RecordForm } from '../RecordForm';
import { SealedRecordView } from '../SealedRecordView';
import { DeleteRecordButton } from '../DeleteRecordButton';

export default async function HistoriaFormPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, recordId } = await params;
  const record = await new SqliteClinicalRecordRepository(ownerUserId).findById(recordId);
  if (!record || !record.belongsTo(id)) notFound();
  const primitives = record.toPrimitives();

  let sections: ClinicalSection[] = BLANK_RECORD_SECTIONS;
  let templateDescription = 'Historia clínica de formato libre.';
  // La historia consolidada (kind='historia') lleva sus propias secciones (núcleo
  // + bloques) y habilita el catálogo "Añadir bloque".
  const enableBlocks = primitives.kind === 'historia';
  if (primitives.sections && primitives.sections.length > 0) {
    sections = primitives.sections;
    templateDescription = enableBlocks
      ? 'Expediente consolidado: núcleo de la historia + bloques por enfoque que añadas abajo.'
      : 'Historia clínica personalizada.';
  } else if (primitives.templateId) {
    const template = await new SqliteClinicalTemplateRepository(ownerUserId).findById(primitives.templateId);
    if (template) {
      const templatePrimitives = template.toPrimitives();
      sections = templatePrimitives.sections;
      templateDescription = templatePrimitives.description;
    } else {
      sections = [];
      templateDescription = 'La plantilla original de esta historia fue eliminada.';
    }
  }

  // Expediente sellado (anterior): solo lectura. No se edita ni se borra desde
  // aquí — se preserva por continuidad clínica.
  if (record.isSealed()) {
    const sealedAt = record.sealedAt();
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={`/pacientes/${id}/historia`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-accent-2"
          >
            <ArrowLeft size={16} /> Volver a historias
          </Link>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-bg/60 px-4 py-3 text-sm text-ink">
          <Lock size={16} className="shrink-0 text-ink-soft" />
          <span>
            <span className="font-semibold">Expediente anterior (solo lectura).</span>{' '}
            {sealedAt
              ? `Sellado el ${format(new Date(sealedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}. `
              : ''}
            Se conserva por continuidad clínica; el expediente vigente es el que está abierto.
          </span>
        </div>
        <h1 className="mb-3 text-xl font-bold text-ink">{primitives.title}</h1>
        <SealedRecordView sections={sections} answers={primitives.answers} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/pacientes/${id}/historia`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-accent-2"
        >
          <ArrowLeft size={16} /> Volver a historias
        </Link>
        <DeleteRecordButton
          recordId={recordId}
          patientId={id}
          recordTitle={primitives.title}
          redirectToList
        />
      </div>
      <RecordForm
        recordId={recordId}
        patientId={id}
        title={primitives.title}
        description={templateDescription}
        sections={sections}
        initialAnswers={primitives.answers}
        enableBlocks={enableBlocks}
      />
    </div>
  );
}
