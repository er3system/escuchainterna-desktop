import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalAnswerValue } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { BLANK_RECORD_SECTIONS } from '@/contexts/clinical-records/domain/blankRecordSections';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { Card, PageHeader } from '@/components/ui';
import { SupervisionBanner } from '../../../../../SupervisionBanner';
import {
  requireSupervisor,
  requireSupervisionLink,
  requireSupervisedPatient,
} from '../../../../../supervisionData';

function formatAnswer(value: ClinicalAnswerValue | undefined): string | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : null;
  return value.trim() === '' ? null : value;
}

export default async function SupervisedRecordPage({
  params,
}: {
  params: Promise<{ userId: string; patientId: string; recordId: string }>;
}) {
  const { userId: supervisorId } = await requireSupervisor();
  const { userId, patientId, recordId } = await params;
  const link = await requireSupervisionLink(supervisorId, userId);
  if (!link.scope.historias) notFound();
  const patient = await requireSupervisedPatient(userId, patientId);

  // Bitácora de acceso (v3 §1.2): la vista de supervisión también deja rastro.
  await logRecordAccess(supervisorId, patientId, 'supervision');

  // Repositorios scoped al SUPERVISADO: solo se llega aquí con vínculo vigente.
  const record = await new SqliteClinicalRecordRepository(userId).findById(recordId);
  if (!record || !record.belongsTo(patientId)) notFound();
  const primitives = record.toPrimitives();

  let sections: ClinicalSection[] = BLANK_RECORD_SECTIONS;
  let templateName = 'Formato libre';
  if (primitives.templateId) {
    const template = await new SqliteClinicalTemplateRepository(userId).findById(primitives.templateId);
    if (template) {
      const templatePrimitives = template.toPrimitives();
      sections = templatePrimitives.sections;
      templateName = templatePrimitives.name;
    } else {
      sections = [];
      templateName = 'Plantilla eliminada';
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SupervisionBanner detail={`Historia de ${link.supervisedName} sobre ${patient.fullName}`} />
      <div className="mb-4">
        <Link
          href={`/supervision/${userId}/pacientes/${patientId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver al paciente
        </Link>
      </div>
      <PageHeader
        title={primitives.title}
        subtitle={`Plantilla: ${templateName} · Actualizada el ${format(
          new Date(primitives.updatedAt),
          "d 'de' MMMM 'de' yyyy, HH:mm",
          { locale: es },
        )}`}
      />

      {sections.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">
            La plantilla original de esta historia fue eliminada; no es posible mostrar sus campos.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id}>
              <h2 className="text-base font-bold text-ink">{section.title}</h2>
              {section.description ? (
                <p className="mt-0.5 text-xs text-ink-soft">{section.description}</p>
              ) : null}
              <dl className="mt-3 space-y-3">
                {section.fields.map((field) => {
                  const answer = formatAnswer(primitives.answers[field.id]);
                  return (
                    <div key={field.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {field.label}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-ink">
                        {answer ?? <span className="italic text-ink-soft">Sin respuesta</span>}
                        {answer && field.type === 'escala' && field.scaleMax !== undefined
                          ? ` / ${field.scaleMax}`
                          : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
