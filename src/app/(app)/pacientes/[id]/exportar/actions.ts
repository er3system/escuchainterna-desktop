'use server';

import { revalidatePath } from 'next/cache';
import { CreatePatientReport } from '@/contexts/clinical-records/application/create-patient-report/CreatePatientReport';
import { CreatePatientReportMessage } from '@/contexts/clinical-records/application/create-patient-report/CreatePatientReportMessage';
import { UpdatePatientReport } from '@/contexts/clinical-records/application/update-patient-report/UpdatePatientReport';
import { UpdatePatientReportMessage } from '@/contexts/clinical-records/application/update-patient-report/UpdatePatientReportMessage';
import { SignPatientReport } from '@/contexts/clinical-records/application/sign-patient-report/SignPatientReport';
import { SignPatientReportMessage } from '@/contexts/clinical-records/application/sign-patient-report/SignPatientReportMessage';
import { DeletePatientReport } from '@/contexts/clinical-records/application/delete-patient-report/DeletePatientReport';
import { CreateExpedienteReport } from '@/contexts/clinical-records/application/create-expediente-report/CreateExpedienteReport';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { SqliteReportSignatureRequestRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteReportSignatureRequestRepository';
import { SqliteMySupervisorsReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteMySupervisorsReader';
import { RequestReportSignature } from '@/contexts/clinical-records/application/report-signature/RequestReportSignature';
import { CancelSignatureRequest } from '@/contexts/clinical-records/application/report-signature/CancelSignatureRequest';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import { SqliteNotificationRepository } from '@/contexts/notifications/infrastructure/persistence/SqliteNotificationRepository';
import { createSessionInsights } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { AI_BUDGET_BLOCKED_MESSAGE, resolveAiAccess } from '@/shared/infrastructure/ai-billing/AiBudgetGate';

export async function createReportAction(
  patientId: string,
  kind: string,
  countryCode: string,
): Promise<{ ok: true; reportId: string } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await auditCustodyAccess(ownerUserId, patientId, 'exportar');
  // Puerta de presupuesto ANTES de tocar el motor: bloqueo amable o modelo por plan.
  const acceso = await resolveAiAccess(ownerUserId, 'borrador_reporte');
  if (!acceso.allowed) return { ok: false, error: acceso.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE };
  try {
    const useCase = new CreatePatientReport(
      new SqlitePatientDirectory(ownerUserId),
      new SqliteDiagnosisRepository(ownerUserId),
      new SqliteSessionNoteRepository(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
      new SqlitePatientReportRepository(ownerUserId),
      await createSessionInsights({ ownerUserId, model: acceso.model }),
    );
    const reportId = await useCase.execute(
      new CreatePatientReportMessage({ patientId, kind, countryCode }),
    );
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true, reportId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear el reporte.' };
  }
}

export async function createExpedienteReportAction(
  patientId: string,
): Promise<{ ok: true; reportId: string } | { ok: false; error: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await auditCustodyAccess(ownerUserId, patientId, 'exportar');
  try {
    // Ensamble determinista del expediente (sin IA): no pasa por la puerta de presupuesto.
    const reportId = await new CreateExpedienteReport(
      new SqlitePatientDirectory(ownerUserId),
      new SqliteClinicalRecordRepository(ownerUserId),
      new SqliteSessionNoteRepository(ownerUserId),
      new SqliteDiagnosisRepository(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
      new SqlitePatientReportRepository(ownerUserId),
    ).execute(patientId);
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true, reportId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo generar la historia clínica completa.',
    };
  }
}

export async function updateReportAction(
  reportId: string,
  patientId: string,
  input: { title: string; content: string; reviewed: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new UpdatePatientReport(new SqlitePatientReportRepository(ownerUserId));
    await useCase.execute(new UpdatePatientReportMessage({ reportId, patientId, ...input }));
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar el reporte.' };
  }
}

export async function signReportAction(
  reportId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    // La identidad firmante (nombre + tarjeta profesional) se resuelve dentro del
    // caso de uso desde el PERFIL del usuario autenticado, nunca desde el cliente:
    // firmar exige tarjeta profesional registrada.
    const useCase = new SignPatientReport(
      new SqlitePatientReportRepository(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
    );
    await useCase.execute(new SignPatientReportMessage({ reportId, patientId, signerUserId: ownerUserId }));
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo firmar el reporte.' };
  }
}

export async function deleteReportAction(
  reportId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new DeletePatientReport(new SqlitePatientReportRepository(ownerUserId));
    await useCase.execute(reportId, patientId);
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el reporte.' };
  }
}

/**
 * El practicante (sin tarjeta) pide a su supervisor que firme un reporte revisado. La
 * organización del vínculo se resuelve en el servidor desde los supervisores activos
 * del solicitante (el cliente solo elige a quién). Avisa al supervisor.
 */
export async function requestReportSignatureAction(
  reportId: string,
  patientId: string,
  supervisorUserId: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const requesterUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const supervisor = await new SqliteMySupervisorsReader().find(requesterUserId, supervisorUserId);
    if (!supervisor) {
      return { ok: false, error: 'La persona elegida no es un supervisor activo de tu cuenta.' };
    }
    const supervisorReader = new SqliteSupervisorReader();
    const useCase = new RequestReportSignature(
      new SqliteReportSignatureRequestRepository(),
      new SqlitePatientReportRepository(requesterUserId),
      // Estricto (vínculo vigente + ambos activos): coherente con la firma/lectura.
      { supervises: (s, sub, org) => supervisorReader.supervisesActive(s, sub, org) },
    );
    const requestId = await useCase.execute({
      reportId,
      patientId,
      requesterUserId,
      supervisorUserId,
      organizationId: supervisor.organizationId,
      note,
    });
    await new SqliteNotificationRepository().insert({
      recipientUserId: supervisorUserId,
      kind: 'supervision',
      title: 'Solicitud de firma',
      body: 'Un supervisado te pidió firmar un reporte. Revísalo y fírmalo o recházalo.',
      link: `/supervision/firmas/${requestId}`,
      createdBy: requesterUserId,
    });
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo enviar la solicitud de firma.',
    };
  }
}

/** El practicante retira su solicitud de firma aún pendiente. */
export async function cancelSignatureRequestAction(
  requestId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const requesterUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new CancelSignatureRequest(new SqliteReportSignatureRequestRepository()).execute({
      requestId,
      requesterUserId,
    });
    revalidatePath(`/pacientes/${patientId}/exportar`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo cancelar la solicitud.',
    };
  }
}
