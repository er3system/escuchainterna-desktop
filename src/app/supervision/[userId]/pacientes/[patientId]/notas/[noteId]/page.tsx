import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { ListSupervisionReviews } from '@/contexts/identity/application/list-supervision-reviews/ListSupervisionReviews';
import { SqliteSupervisionReviewRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionReviewRepository';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { Card, PageHeader } from '@/components/ui';
import { SupervisionBanner } from '../../../../../SupervisionBanner';
import {
  requireSupervisor,
  requireSupervisionLink,
  requireSupervisedPatient,
  requireSupervisedNote,
} from '../../../../../supervisionData';
import { ReviewPanel } from './ReviewPanel';

export default async function SupervisedNotePage({
  params,
}: {
  params: Promise<{ userId: string; patientId: string; noteId: string }>;
}) {
  const { userId: supervisorId } = await requireSupervisor();
  const { userId, patientId, noteId } = await params;
  const link = await requireSupervisionLink(supervisorId, userId);
  if (!link.scope.notas) notFound();
  const patient = await requireSupervisedPatient(userId, patientId);
  const note = await requireSupervisedNote(userId, patientId, noteId);

  // Bitácora de acceso (v3 §1.2): la vista de supervisión también deja rastro.
  await logRecordAccess(supervisorId, patientId, 'supervision');

  // Retroalimentación PROPIA del supervisor en sesión sobre esta nota (v3.2).
  const review = (
    await new ListSupervisionReviews(new SqliteSupervisionReviewRepository()).forNotes(
      [noteId],
      supervisorId,
    )
  )[noteId];

  return (
    <div className="mx-auto max-w-3xl">
      <SupervisionBanner detail={`Nota de ${link.supervisedName} sobre ${patient.fullName}`} />
      <div className="mb-4">
        <Link
          href={`/supervision/${userId}/pacientes/${patientId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver al paciente
        </Link>
      </div>
      <PageHeader
        title={note.title}
        subtitle={`Última edición: ${format(new Date(note.updatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`}
      />
      <Card>
        {note.content.trim() === '' ? (
          <p className="text-sm text-ink-soft">Esta nota no tiene contenido.</p>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</div>
        )}
      </Card>

      {/* Retroalimentación académica (v3.2): lo único editable en supervisión. */}
      <div className="mt-6">
        <ReviewPanel
          noteId={noteId}
          supervisedUserId={userId}
          patientId={patientId}
          supervisedName={link.supervisedName}
          initialComment={review?.comment ?? ''}
          initialReviewed={review?.reviewed ?? false}
          initialUpdatedAt={review?.updatedAt ?? null}
        />
      </div>
    </div>
  );
}
