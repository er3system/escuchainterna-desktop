'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CreateSessionNote } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNote';
import { CreateSessionNoteMessage } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNoteMessage';
import { UpdateSessionNote } from '@/contexts/clinical-records/application/update-session-note/UpdateSessionNote';
import { UpdateSessionNoteMessage } from '@/contexts/clinical-records/application/update-session-note/UpdateSessionNoteMessage';
import { SaveSessionAnswers } from '@/contexts/clinical-records/application/save-session-answers/SaveSessionAnswers';
import { SaveSessionAnswersMessage } from '@/contexts/clinical-records/application/save-session-answers/SaveSessionAnswersMessage';
import { AddSessionBlock } from '@/contexts/clinical-records/application/session-blocks/AddSessionBlock';
import { RemoveSessionBlock } from '@/contexts/clinical-records/application/session-blocks/RemoveSessionBlock';
import { ReorderSessions } from '@/contexts/clinical-records/application/reorder-sessions/ReorderSessions';
import { SetSessionArchived } from '@/contexts/clinical-records/application/set-session-archived/SetSessionArchived';
import { PolishNote } from '@/contexts/clinical-records/application/polish-note/PolishNote';
import { AskNotesQuestion } from '@/contexts/clinical-records/application/ask-notes-question/AskNotesQuestion';
import { GenerateNotesReport } from '@/contexts/clinical-records/application/generate-notes-report/GenerateNotesReport';
import { SuggestRecordUpdates } from '@/contexts/clinical-records/application/suggest-record-updates/SuggestRecordUpdates';
import { ApplyRecordSuggestions } from '@/contexts/clinical-records/application/apply-record-suggestions/ApplyRecordSuggestions';
import { ApplyRecordSuggestionsMessage } from '@/contexts/clinical-records/application/apply-record-suggestions/ApplyRecordSuggestionsMessage';
import type { SessionReport } from '@/contexts/clinical-records/domain/SessionInsights';
import type { RecordSuggestionBatchPrimitives } from '@/contexts/clinical-records/domain/RecordSuggestionBatch';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqliteAiInteractionLog } from '@/contexts/clinical-records/infrastructure/persistence/SqliteAiInteractionLog';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { SqliteRecordSuggestionRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRecordSuggestionRepository';
import { MarkBookingPaid } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaid';
import { MarkBookingPaidMessage } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaidMessage';
import { MarkBookingUnpaid } from '@/contexts/billing/application/mark-booking-unpaid/MarkBookingUnpaid';
import { MarkBookingUnpaidMessage } from '@/contexts/billing/application/mark-booking-unpaid/MarkBookingUnpaidMessage';
import { SqliteBookingPaymentRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBookingPaymentRepository';
import { createSessionInsights } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import {
  assertPatientNotInInstitutionalCustody,
  requireClinicalRecordAccessUserId,
  requireClinicalRecordWriteAccess,
  requirePaymentWriteOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { AI_BUDGET_BLOCKED_MESSAGE, resolveAiAccess } from '@/shared/infrastructure/ai-billing/AiBudgetGate';

export async function createNoteAction(patientId: string, formData: FormData): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const title = String(formData.get('title') ?? '');
  const sessionKind = String(formData.get('sessionKind') ?? '');
  const useCase = new CreateSessionNote(new SqliteSessionNoteRepository(ownerUserId));
  const noteId = await useCase.execute(new CreateSessionNoteMessage({ patientId, title, sessionKind }));
  revalidatePath(`/pacientes/${patientId}/historia`);
  // Vuelve a la Evolución de dos paneles con la sesión nueva ya seleccionada (P6.2).
  redirect(`/pacientes/${patientId}/historia?vista=evolucion&sesion=${noteId}`);
}

export async function saveSessionAnswersAction(
  noteId: string,
  patientId: string,
  answers: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new SaveSessionAnswers(new SqliteSessionNoteRepository(ownerUserId));
    await useCase.execute(new SaveSessionAnswersMessage({ noteId, patientId, answers }));
    revalidatePath(`/pacientes/${patientId}/sesiones/${noteId}`);
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la sesión.' };
  }
}

/** Añade un bloque curado a una sesión (Evolución de dos paneles, P6.2). */
export async function addSessionBlockAction(
  noteId: string,
  patientId: string,
  blockId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new AddSessionBlock(new SqliteSessionNoteRepository(ownerUserId)).execute(noteId, patientId, blockId);
    revalidatePath(`/pacientes/${patientId}/historia`);
    revalidatePath(`/pacientes/${patientId}/sesiones/${noteId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo añadir el bloque.' };
  }
}

/** Reordena las sesiones de la Evolución (P8): orderedIds de arriba a abajo. */
export async function reorderSessionsAction(
  patientId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new ReorderSessions(new SqliteSessionNoteRepository(ownerUserId)).execute(patientId, orderedIds);
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo reordenar.' };
  }
}

/** Quita un bloque de una sesión por id de sección (solo bloques namespaced). */
export async function removeSessionBlockAction(
  noteId: string,
  patientId: string,
  sectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new RemoveSessionBlock(new SqliteSessionNoteRepository(ownerUserId)).execute(noteId, patientId, sectionId);
    revalidatePath(`/pacientes/${patientId}/historia`);
    revalidatePath(`/pacientes/${patientId}/sesiones/${noteId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo quitar el bloque.' };
  }
}

export async function updateNoteAction(
  noteId: string,
  patientId: string,
  title: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new UpdateSessionNote(new SqliteSessionNoteRepository(ownerUserId));
    await useCase.execute(new UpdateSessionNoteMessage({ noteId, patientId, title, content }));
    revalidatePath(`/pacientes/${patientId}/sesiones`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la nota.' };
  }
}

export async function setSessionArchivedAction(
  noteId: string,
  patientId: string,
  archived: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new SetSessionArchived(new SqliteSessionNoteRepository(ownerUserId)).execute(noteId, patientId, archived);
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo archivar la sesión.' };
  }
}

export async function polishNoteAction(
  noteId: string,
  patientId: string,
): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  // Custodia (§3.3): procesar con IA la nota de un paciente retenido es una lectura
  // clínica de ruptura de cristal (devuelve el contenido reescrito) y debe trazarse.
  await auditCustodyAccess(ownerUserId, patientId, 'sesiones');
  // Puerta de presupuesto ANTES del motor: bloqueo amable o modelo por plan.
  const acceso = await resolveAiAccess(ownerUserId, 'pulir_nota');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const repo = new SqliteSessionNoteRepository(ownerUserId);
    const note = await repo.findById(noteId);
    if (!note || !note.belongsTo(patientId)) return { ok: false, error: 'Nota no encontrada.' };
    if (note.currentContent().trim() === '') {
      return { ok: false, error: 'Escribe algo en la nota antes de pulirla con IA.' };
    }
    const draft = await new PolishNote(
      repo,
      await createSessionInsights({ ownerUserId, model: acceso.model }),
    ).execute(noteId, patientId);
    return { ok: true, draft };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo pulir la nota.' };
  }
}

export async function askQuestionAction(
  noteId: string,
  patientId: string,
  question: string,
): Promise<{ ok: true; response: string; createdAt: string } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await auditCustodyAccess(ownerUserId, patientId, 'sesiones');
  // Puerta de presupuesto ANTES de tocar el motor: bloqueo amable o modelo por plan.
  const acceso = await resolveAiAccess(ownerUserId, 'pregunta_nota');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const useCase = new AskNotesQuestion(
      new SqliteSessionNoteRepository(ownerUserId),
      await createSessionInsights({ ownerUserId, model: acceso.model }),
      new SqliteAiInteractionLog(ownerUserId),
    );
    const interaction = await useCase.execute(noteId, patientId, question);
    return { ok: true, response: interaction.response, createdAt: interaction.createdAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'La IA no pudo responder.' };
  }
}

export async function suggestRecordUpdatesAction(
  noteId: string,
  patientId: string,
  recordId: string,
): Promise<{ ok: true; batch: RecordSuggestionBatchPrimitives } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await auditCustodyAccess(ownerUserId, patientId, 'sesiones');
  const acceso = await resolveAiAccess(ownerUserId, 'sugerencias_historia');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const useCase = new SuggestRecordUpdates(
      new SqliteSessionNoteRepository(ownerUserId),
      new SqliteClinicalRecordRepository(ownerUserId),
      new SqliteClinicalTemplateRepository(ownerUserId),
      new SqliteRecordSuggestionRepository(ownerUserId),
      await createSessionInsights({ ownerUserId, model: acceso.model }),
    );
    const batch = await useCase.execute({ noteId, patientId, recordId });
    return { ok: true, batch };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudieron generar sugerencias.',
    };
  }
}

export async function applyRecordSuggestionsAction(
  batchId: string,
  patientId: string,
  decisions: Record<string, 'aprobada' | 'rechazada'>,
): Promise<{ ok: true; appliedCount: number; rejectedCount: number } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new ApplyRecordSuggestions(
      new SqliteRecordSuggestionRepository(ownerUserId),
      new SqliteClinicalRecordRepository(ownerUserId),
    );
    const result = await useCase.execute(
      new ApplyRecordSuggestionsMessage({ batchId, patientId, decisions }),
    );
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudieron aplicar las sugerencias.',
    };
  }
}

export async function toggleBookingPaymentAction(
  bookingId: string,
  patientId: string,
  markAsPaid: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requirePaymentWriteOwnerUserId();
  await assertPatientNotInInstitutionalCustody(patientId, ownerUserId);
  try {
    const payments = new SqliteBookingPaymentRepository(ownerUserId);
    if (markAsPaid) {
      await new MarkBookingPaid(payments).markPaid(
        new MarkBookingPaidMessage({ bookingId, method: 'efectivo' }),
      );
    } else {
      await new MarkBookingUnpaid(payments).markUnpaid(new MarkBookingUnpaidMessage({ bookingId }));
    }
    revalidatePath(`/pacientes/${patientId}/sesiones`);
    revalidatePath(`/pacientes/${patientId}/pagos`);
    revalidatePath('/pagos');
    revalidatePath('/inicio');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo cambiar el estado de pago.',
    };
  }
}

export async function generateReportAction(
  noteId: string,
): Promise<{ ok: true; report: SessionReport; generatedAt: string } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordAccessUserId();
  // El id de paciente no llega como argumento: se deriva de la nota antes de generar
  // cualquier salida. En custodia, la generación queda vedada por el modo solo lectura.
  const noteForAccess = await new SqliteSessionNoteRepository(ownerUserId).findById(noteId);
  if (noteForAccess) {
    await assertPatientNotInInstitutionalCustody(
      noteForAccess.toPrimitives().patientId,
      ownerUserId,
    );
  }
  const acceso = await resolveAiAccess(ownerUserId, 'reporte_sesion');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const useCase = new GenerateNotesReport(
      new SqliteSessionNoteRepository(ownerUserId),
      await createSessionInsights({ ownerUserId, model: acceso.model }),
      new SqliteAiInteractionLog(ownerUserId),
    );
    const generated = await useCase.execute(noteId);
    return { ok: true, report: generated.report, generatedAt: generated.generatedAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo generar el reporte.' };
  }
}
