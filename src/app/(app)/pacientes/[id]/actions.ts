'use server';

import { revalidatePath } from 'next/cache';
import { findInstrument, scoreAssessment } from '@/contexts/clinical-records/domain/assessmentInstruments';
import { SqlitePatientAssessmentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientAssessmentRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqlitePatientNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository';
import {
  toProcessStatus,
  toSessionFrequency,
  toSessionModality,
} from '@/contexts/patients/domain/value-objects/clinicalProfile';
import {
  requireClinicalRecordWriteAccess,
  requirePatientOperationalWriteContext,
} from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface UpdatePatientSummaryInput {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  consultationReason: string;
  therapyStartDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  tags: string;
  documentType: string;
  documentNumber: string;
  guardianName: string;
  guardianRelationship: string;
  guardianDocument: string;
  currentMedication: string;
  medicalHistory: string;
  sessionFrequency: string;
  sessionModality: string;
  processStatus: string;
  treatmentEndDate: string;
  treatmentEndReason: string;
  insuranceName: string;
  insurancePolicyNumber: string;
  referralSource: string;
  customFields: { label: string; value: string }[];
  /** §5.6: confirma guardar pese a un documento duplicado de otro paciente. */
  confirmDuplicate?: boolean;
}

export async function updatePatientSummaryAction(
  patientId: string,
  input: UpdatePatientSummaryInput,
): Promise<{ ok: boolean; error?: string; duplicateWarning?: string }> {
  const { ownerUserId, isAssistant } = await requirePatientOperationalWriteContext(patientId);
  const directory = new SqlitePatientDirectory(ownerUserId);
  const existing = await directory.findSummary(patientId);
  if (!existing) return { ok: false, error: 'El paciente no existe.' };
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: 'El nombre es obligatorio.' };

  const documentNumber = isAssistant ? existing.documentNumber : input.documentNumber.trim();
  // Dedupe-avisa (§5.6): avisa si OTRO paciente del dueño ya tiene ese documento.
  if (documentNumber && !input.confirmDuplicate) {
    const duplicate = await directory.findDuplicateByDocument(documentNumber, patientId);
    if (duplicate) {
      return {
        ok: false,
        duplicateWarning: `Otro paciente ya tiene este documento: ${duplicate.fullName}. Guarda de todos modos si es correcto.`,
      };
    }
  }

  await directory.updateSummary(patientId, {
    fullName,
    email: input.email.trim(),
    phone: input.phone.trim(),
    birthDate: isAssistant ? existing.birthDate : input.birthDate.trim() === '' ? null : input.birthDate.trim(),
    gender: isAssistant ? existing.gender : input.gender.trim(),
    consultationReason: isAssistant ? existing.consultationReason : input.consultationReason.trim(),
    therapyStartDate: isAssistant
      ? existing.therapyStartDate
      : input.therapyStartDate.trim() === ''
        ? null
        : input.therapyStartDate.trim(),
    emergencyContactName: input.emergencyContactName.trim(),
    emergencyContactPhone: input.emergencyContactPhone.trim(),
    notes: isAssistant ? existing.notes : input.notes.trim(),
    tags: isAssistant
      ? existing.tags
      : input.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ''),
    documentType: isAssistant ? existing.documentType : input.documentType.trim(),
    documentNumber,
    guardianName: isAssistant ? existing.guardianName : input.guardianName.trim(),
    guardianRelationship: isAssistant ? existing.guardianRelationship : input.guardianRelationship.trim(),
    guardianDocument: isAssistant ? existing.guardianDocument : input.guardianDocument.trim(),
    currentMedication: isAssistant ? existing.currentMedication : input.currentMedication.trim(),
    medicalHistory: isAssistant ? existing.medicalHistory : input.medicalHistory.trim(),
    sessionFrequency: isAssistant ? existing.sessionFrequency : toSessionFrequency(input.sessionFrequency),
    sessionModality: isAssistant ? existing.sessionModality : toSessionModality(input.sessionModality),
    processStatus: isAssistant ? existing.processStatus : toProcessStatus(input.processStatus),
    treatmentEndDate: isAssistant
      ? existing.treatmentEndDate
      : input.treatmentEndDate.trim() === ''
        ? null
        : input.treatmentEndDate.trim(),
    treatmentEndReason: isAssistant ? existing.treatmentEndReason : input.treatmentEndReason.trim(),
    insuranceName: isAssistant ? existing.insuranceName : input.insuranceName.trim(),
    insurancePolicyNumber: isAssistant ? existing.insurancePolicyNumber : input.insurancePolicyNumber.trim(),
    referralSource: isAssistant ? existing.referralSource : input.referralSource.trim(),
    customFields: isAssistant
      ? existing.customFields
      : input.customFields
          .map((field) => ({ label: field.label.trim(), value: field.value.trim() }))
          .filter((field) => field.label !== ''),
  });
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}

export async function addPatientNoteAction(
  patientId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const text = body.trim();
  if (!text) return { ok: false, error: 'La nota no puede estar vacía.' };
  // Pertenencia (defensa en profundidad, como updatePatientSummaryAction): no escribir
  // contra un patientId que no sea del dueño en sesión.
  if (!(await new SqlitePatientDirectory(ownerUserId).findSummary(patientId))) {
    return { ok: false, error: 'El paciente no existe.' };
  }
  await new SqlitePatientNoteRepository(ownerUserId).add(patientId, text);
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}

export async function deletePatientNoteAction(
  patientId: string,
  noteId: string,
): Promise<{ ok: boolean }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new SqlitePatientNoteRepository(ownerUserId).delete(noteId, patientId);
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}

export async function applyAssessmentAction(
  patientId: string,
  instrumentId: string,
  answers: number[],
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const instrument = findInstrument(instrumentId);
  if (!instrument) return { ok: false, error: 'Instrumento no reconocido.' };
  // Exige responder todos los ítems: nada a medias en una escala puntuada.
  if (answers.length !== instrument.items.length || answers.some((value) => typeof value !== 'number')) {
    return { ok: false, error: 'Responde todos los ítems antes de guardar.' };
  }
  // Pertenencia (defensa en profundidad): no aplicar contra un paciente que no es del dueño.
  if (!(await new SqlitePatientDirectory(ownerUserId).findSummary(patientId))) {
    return { ok: false, error: 'El paciente no existe.' };
  }
  // Puntaje autoritativo: se recalcula en el servidor (no se confía en el cliente).
  const { total, severity, riskFlag } = scoreAssessment(instrument, answers);
  await new SqlitePatientAssessmentRepository(ownerUserId).add(patientId, {
    instrumentId: instrument.id,
    answers: answers.map((value) => Math.trunc(value)),
    totalScore: total,
    severity: severity?.label ?? '',
    riskFlag,
    notes: notes.trim(),
  });
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}

export async function deleteAssessmentAction(
  patientId: string,
  assessmentId: string,
): Promise<{ ok: boolean }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new SqlitePatientAssessmentRepository(ownerUserId).delete(assessmentId, patientId);
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}

/**
 * "Tratado en" (Modo Sedes, MS2): el tratante fija/cambia la sede de atención del
 * paciente. Solo tiene efecto si su organización está en modo 'compartido' y la sede es
 * de esa misma org; acotado al dueño (WHERE owner_user_id). consultorioId '' = sin sede.
 */
export async function setPatientConsultorioAction(
  patientId: string,
  consultorioId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const db = getDatabaseAdapter();
  const org = (await db.queryRow(
    `SELECT o.id AS org_id, o.consultorio_mode AS mode
         FROM organization_memberships m
         JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ? LIMIT 1`,
    [ownerUserId],
  )) as { org_id: string; mode: string } | null;
  if (!org || org.mode !== 'compartido') {
    return { ok: false, error: 'La sede del paciente solo se edita en organizaciones con modo Sedes.' };
  }

  const value = consultorioId.trim();
  if (value !== '') {
    const valid = await db.queryRow(
      `SELECT 1 FROM consultorios WHERE id = ? AND organization_id = ? AND archived = 0 LIMIT 1`,
      [value, org.org_id],
    );
    if (!valid) return { ok: false, error: 'Esa sede no pertenece a tu organización.' };
  }

  await db.execute('UPDATE patients SET consultorio_id = ? WHERE id = ? AND owner_user_id = ?', [
    value === '' ? null : value,
    patientId,
    ownerUserId,
  ]);
  revalidatePath(`/pacientes/${patientId}`, 'layout');
  return { ok: true };
}
