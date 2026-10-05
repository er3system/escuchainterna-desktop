import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { ListSupervisionReviews } from '@/contexts/identity/application/list-supervision-reviews/ListSupervisionReviews';
import { SqliteSupervisionReviewRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionReviewRepository';
import { Badge } from '@/components/ui';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqliteAiInteractionLog } from '@/contexts/clinical-records/infrastructure/persistence/SqliteAiInteractionLog';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { ListClinicalRecords } from '@/contexts/clinical-records/application/list-clinical-records/ListClinicalRecords';
import { sessionInsightsProviderName } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import {
  SESSION_KIND_LABELS,
  sessionKindForTemplateId,
  sessionTemplateForKind,
} from '@/contexts/clinical-records/domain/sessionTemplates';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { SessionEditor } from './SessionEditor';
import { AiPanel } from './AiPanel';
import { SuggestionsPanel } from './SuggestionsPanel';

export default async function NotaSesionPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, noteId } = await params;
  const note = await new SqliteSessionNoteRepository(ownerUserId).findById(noteId);
  if (!note || !note.belongsTo(id)) notFound();
  const primitives = note.toPrimitives();

  const log = new SqliteAiInteractionLog(ownerUserId);
  const questions = (await log.listForNote(noteId, 'pregunta')).map((interaction) => ({
    question: interaction.prompt,
    response: interaction.response,
    createdAt: interaction.createdAt,
  }));
  const provider = await sessionInsightsProviderName();

  // Sesión estructurada: si la nota se creó con plantilla (1ª/seguimiento),
  // se resuelve para renderizar su formulario junto al texto libre. Los bloques
  // añadidos (sections_json) se concatenan al formulario base de la plantilla.
  const sessionKind = sessionKindForTemplateId(primitives.templateId);
  const sessionTemplate = sessionKind ? sessionTemplateForKind(sessionKind) : null;
  const sessionSections: ClinicalSection[] = [
    ...(sessionTemplate?.sections ?? []),
    ...(primitives.sections ?? []),
  ];

  const recordOptions = (
    await new ListClinicalRecords(
      new SqliteClinicalRecordRepository(ownerUserId),
      new SqliteClinicalTemplateRepository(ownerUserId),
    ).execute(id)
  ).map((record) => ({ id: record.id, title: record.title, templateName: record.templateName }));

  // Retroalimentación de supervisión sobre ESTA nota (v3.2): solo lectura para
  // el estudiante — la escribe su supervisor y no se puede editar ni borrar aquí.
  const supervisorReviews = await new ListSupervisionReviews(
    new SqliteSupervisionReviewRepository(),
  ).forSupervisedNote(noteId, ownerUserId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/pacientes/${id}/historia?vista=evolucion`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver al expediente
        </Link>
        {sessionKind ? <Badge tone="primary">{SESSION_KIND_LABELS[sessionKind]}</Badge> : null}
      </div>

      {supervisorReviews.length > 0 ? (
        <div className="mb-4 space-y-3">
          {supervisorReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/40 dark:bg-primary/15 p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <GraduationCap size={16} className="text-primary dark:text-accent-2" /> Retroalimentación de tu supervisor
                </p>
                {review.reviewed ? <Badge tone="success">Revisada por tu supervisor</Badge> : null}
              </div>
              {review.comment !== '' ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {review.comment}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-soft">
                {review.supervisorName} ·{' '}
                {format(new Date(review.updatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <SessionEditor
            noteId={noteId}
            patientId={id}
            structuredTitle={sessionTemplate?.name ?? 'Estructura de la sesión'}
            structuredDescription={
              sessionTemplate?.description ??
              'Añade bloques (técnicas, evaluaciones, procesos) a esta sesión.'
            }
            sections={sessionSections}
            initialAnswers={primitives.answers}
            initialTitle={primitives.title}
            initialContent={primitives.content}
            createdAt={primitives.createdAt}
          />
          <SuggestionsPanel noteId={noteId} patientId={id} records={recordOptions} provider={provider} />
        </div>
        <div className="xl:col-span-2">
          <AiPanel noteId={noteId} patientId={id} provider={provider} initialQuestions={questions} />
        </div>
      </div>
    </div>
  );
}
