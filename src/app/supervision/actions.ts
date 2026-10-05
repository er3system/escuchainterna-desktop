'use server';

import { revalidatePath } from 'next/cache';
import { SaveSupervisionReview } from '@/contexts/identity/application/save-supervision-review/SaveSupervisionReview';
import { SaveSupervisionReviewMessage } from '@/contexts/identity/application/save-supervision-review/SaveSupervisionReviewMessage';
import { SummarizeCaseForSupervision } from '@/contexts/identity/application/summarize-case-for-supervision/SummarizeCaseForSupervision';
import { SummarizeCaseForSupervisionMessage } from '@/contexts/identity/application/summarize-case-for-supervision/SummarizeCaseForSupervisionMessage';
import { SqliteSupervisionAccessReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionAccessReader';
import { SqliteSupervisionReviewRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionReviewRepository';
import { InAppSupervisionReviewNotifier } from '@/contexts/identity/infrastructure/notifications/InAppSupervisionReviewNotifier';
import { createSessionInsights } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import { SignRequestedReport } from '@/contexts/clinical-records/application/report-signature/SignRequestedReport';
import { RejectSignatureRequest } from '@/contexts/clinical-records/application/report-signature/RejectSignatureRequest';
import { IssueSupervisorCertificate } from '@/contexts/clinical-records/application/report-signature/IssueSupervisorCertificate';
import { SqliteReportSignatureRequestRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteReportSignatureRequestRepository';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import { SqliteNotificationRepository } from '@/contexts/notifications/infrastructure/persistence/SqliteNotificationRepository';
import { AI_BUDGET_BLOCKED_MESSAGE, resolveAiAccess } from '@/shared/infrastructure/ai-billing/AiBudgetGate';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import {
  requireSupervisor,
  requireSupervisionLink,
  requireSupervisedPatient,
  requireHeldPatientForCertification,
} from './supervisionData';

/** Checker estricto para la co-firma: exige vínculo vigente Y supervisado activo (v28). */
function activeSupervisionChecker() {
  const reader = new SqliteSupervisorReader();
  return {
    supervises: (supervisor: string, supervised: string, org?: string) =>
      reader.supervisesActive(supervisor, supervised, org),
  };
}

export interface SavedReviewState {
  comment: string;
  reviewed: boolean;
  updatedAt: string;
}

/**
 * Guarda retroalimentación académica del supervisor sobre una nota del
 * supervisado (comentario y/o marca "revisada"). La autoridad real es el
 * vínculo de supervisión: el caso de uso deriva el dueño desde la nota y
 * falla sin vínculo vigente con alcance de notas. supervisedUserId/patientId
 * solo se usan para revalidar rutas.
 */
export async function saveSupervisionReviewAction(input: {
  noteId: string;
  supervisedUserId: string;
  patientId: string;
  comment?: string;
  reviewed?: boolean;
}): Promise<{ ok: true; review: SavedReviewState } | { ok: false; error: string }> {
  const { userId: supervisorId } = await requireSupervisor();
  try {
    const useCase = new SaveSupervisionReview(
      new SqliteSupervisionAccessReader(),
      new SqliteSupervisionReviewRepository(),
      new InAppSupervisionReviewNotifier(),
    );
    const review = await useCase.save(
      new SaveSupervisionReviewMessage({
        supervisorUserId: supervisorId,
        sessionNoteId: input.noteId,
        comment: input.comment,
        reviewed: input.reviewed,
      }),
    );
    revalidatePath(`/supervision/${input.supervisedUserId}/pacientes/${input.patientId}`);
    revalidatePath(
      `/supervision/${input.supervisedUserId}/pacientes/${input.patientId}/notas/${input.noteId}`,
    );
    return {
      ok: true,
      review: { comment: review.comment, reviewed: review.reviewed, updatedAt: review.updatedAt },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo guardar la retroalimentación.',
    };
  }
}

/**
 * Resumen del caso (IA) para el supervisor. El read model solo accede vía
 * vínculo de supervisión vigente; el gasto de IA se registra al SUPERVISOR
 * con kind 'resumen_supervision' y respeta su puerta de plan. El resultado
 * NO se persiste en el expediente del estudiante.
 */
export async function generateCaseSummaryAction(
  supervisedUserId: string,
  patientId: string,
): Promise<
  | { ok: true; summary: string; generatedAt: string; provider: 'local' | 'anthropic' }
  | { ok: false; error: string }
> {
  const { userId: supervisorId } = await requireSupervisor();
  const acceso = await resolveAiAccess(supervisorId, 'resumen_supervision');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const insights = await createSessionInsights({ ownerUserId: supervisorId, model: acceso.model });
    const useCase = new SummarizeCaseForSupervision(new SqliteSupervisionAccessReader(), insights);
    const summary = await useCase.summarize(
      new SummarizeCaseForSupervisionMessage({
        supervisorUserId: supervisorId,
        supervisedUserId,
        patientId,
      }),
    );
    return {
      ok: true,
      summary,
      generatedAt: new Date().toISOString(),
      provider: insights.providerName(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo generar el resumen del caso.',
    };
  }
}

/**
 * El supervisor FIRMA el reporte del supervisado (co-firma) con su tarjeta. Escritura
 * cross-owner gateada en el caso de uso (solicitud pendiente dirigida a él + vínculo
 * vigente + tarjeta). Atómico: firmar el reporte y resolver la solicitud van juntos.
 * Avisa al practicante.
 */
export async function signRequestedReportAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId: supervisorId } = await requireSupervisor();
  try {
    const requests = new SqliteReportSignatureRequestRepository();
    const request = await requests.findById(requestId);
    const useCase = new SignRequestedReport(
      requests,
      (ownerUserId) => new SqlitePatientReportRepository(ownerUserId),
      (userId) => new SqliteProfessionalIdentityReader(userId),
      activeSupervisionChecker(),
    );
    await getDatabaseAdapter().transaction(() =>
      useCase.execute({ requestId, supervisorUserId: supervisorId }),
    );
    if (request) {
      // Traza del acto de co-firma sobre el expediente del supervisado (acción propia,
      // distinta de 'ver' para no colisionar con el throttle de la vista de revisión).
      await logRecordAccess(supervisorId, request.patient(), 'supervision', 'cofirma');
      // El aviso es secundario: si falla, la firma YA quedó persistida (no revertir).
      try {
        await new SqliteNotificationRepository().insert({
          recipientUserId: request.requester(),
          kind: 'supervision',
          title: 'Tu reporte fue firmado',
          body: 'Tu supervisor firmó el reporte que enviaste a co-firma.',
          link: `/pacientes/${request.patient()}/exportar/reportes/${request.report()}`,
          createdBy: supervisorId,
        });
      } catch {
        // El aviso no es crítico; la firma es lo que importa.
      }
    }
    revalidatePath('/supervision');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo firmar el reporte.' };
  }
}

/**
 * El docente emite SU PROPIO certificado del paciente del supervisado: crea un borrador
 * de constancia PROPIEDAD del docente (owner = docente). Gateado por vínculo de
 * supervisión ACTIVO (requireSupervisionLink) y trazado por la vista; el docente lo
 * firmará luego con SU tarjeta (la institución nunca firma por él). Devuelve el id para
 * llevarlo al editor del certificado.
 */
export async function issueSupervisorCertificateAction(
  supervisedUserId: string,
  patientId: string,
): Promise<{ ok: boolean; reportId?: string; error?: string }> {
  const { userId: supervisorId } = await requireSupervisor();
  // Gate: vínculo vigente + supervisado activo + paciente del supervisado (404 si no).
  const link = await requireSupervisionLink(supervisorId, supervisedUserId);
  const patient = await requireSupervisedPatient(supervisedUserId, patientId);
  try {
    const reportId = await new IssueSupervisorCertificate(
      new SqlitePatientReportRepository(supervisorId),
    ).execute({ patientId, patientName: patient.fullName, supervisedName: link.supervisedName });
    await logRecordAccess(supervisorId, patientId, 'supervision', 'certificado');
    revalidatePath(`/supervision/${supervisedUserId}/pacientes/${patientId}`);
    return { ok: true, reportId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo emitir el certificado.' };
  }
}

/**
 * Edge de B: el docente emite su certificado de un paciente RETENIDO por la institución
 * (estudiante retirado, sin vínculo vigente). Gateado por el gate de custodia
 * (requireHeldPatientForCertification: paciente retenido de su org + el docente consta
 * como supervisor histórico del expediente). Acceso de ruptura de cristal, trazado como
 * 'acceso_cobertura'. El certificado es PROPIEDAD del docente (lo firma con su tarjeta).
 */
export async function issueCustodyCertificateAction(
  patientId: string,
): Promise<{ ok: boolean; reportId?: string; error?: string }> {
  const { userId: supervisorId, context } = await requireSupervisor();
  const organizationId = context.organization?.id;
  if (!organizationId) return { ok: false, error: 'No perteneces a una organización.' };
  // Gate de custodia (404 si el paciente no está retenido o el docente no lo supervisó).
  const patient = await requireHeldPatientForCertification(supervisorId, organizationId, patientId);
  try {
    const reportId = await new IssueSupervisorCertificate(
      new SqlitePatientReportRepository(supervisorId),
    ).execute({ patientId, patientName: patient.patientName });
    // Ruptura de cristal: el docente accede a un expediente en custodia de la institución.
    await logRecordAccess(supervisorId, patientId, 'supervision', 'acceso_cobertura');
    revalidatePath('/supervision');
    return { ok: true, reportId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo emitir el certificado.' };
  }
}

/** El supervisor RECHAZA la solicitud de co-firma con un motivo. Avisa al practicante. */
export async function rejectSignatureRequestAction(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const { userId: supervisorId } = await requireSupervisor();
  try {
    const requests = new SqliteReportSignatureRequestRepository();
    const request = await requests.findById(requestId);
    await new RejectSignatureRequest(requests, activeSupervisionChecker()).execute({
      requestId,
      supervisorUserId: supervisorId,
      reason,
    });
    if (request) {
      try {
        await new SqliteNotificationRepository().insert({
          recipientUserId: request.requester(),
          kind: 'supervision',
          title: 'Solicitud de firma rechazada',
          body: reason.trim() ? `Tu supervisor no firmó: ${reason.trim()}` : 'Tu supervisor no firmó el reporte.',
          link: `/pacientes/${request.patient()}/exportar/reportes/${request.report()}`,
          createdBy: supervisorId,
        });
      } catch {
        // El aviso no es crítico.
      }
    }
    revalidatePath('/supervision');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo rechazar la solicitud.' };
  }
}
