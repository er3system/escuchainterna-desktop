'use server';

import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  assertPatientNotInInstitutionalCustody,
  requireClinicalRecordWriteAccess,
} from '@/shared/infrastructure/auth/dataOwner';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SqliteRelationalCaseRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository';
import { SqliteCaseMemberRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseMemberRepository';
import { SqliteCaseSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseSessionNoteRepository';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { OpenRelationalCase } from '@/contexts/clinical-records/application/relational-cases/OpenRelationalCase';
import { CreateCaseMemberReport } from '@/contexts/clinical-records/application/relational-cases/CreateCaseMemberReport';
import { AddCaseMember } from '@/contexts/clinical-records/application/relational-cases/AddCaseMember';
import { UpdateCaseMember } from '@/contexts/clinical-records/application/relational-cases/UpdateCaseMember';
import { EditCaseProfile } from '@/contexts/clinical-records/application/relational-cases/EditCaseProfile';
import { isMemberRelationQuality } from '@/contexts/clinical-records/domain/value-objects/caseProfile';
import { SetSecretsPolicy } from '@/contexts/clinical-records/application/relational-cases/SetSecretsPolicy';
import { GrantMemberConsent } from '@/contexts/clinical-records/application/relational-cases/GrantMemberConsent';
import { RecordMemberScreening } from '@/contexts/clinical-records/application/relational-cases/RecordMemberScreening';
import { AddJointSession } from '@/contexts/clinical-records/application/relational-cases/AddJointSession';
import { AddIndividualSession } from '@/contexts/clinical-records/application/relational-cases/AddIndividualSession';
import type { SecretsPolicy } from '@/contexts/clinical-records/domain/RelationalCase';
import type { ScreeningStatus } from '@/contexts/clinical-records/domain/CaseMember';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Autoriza una mutación del caso usando una ficha ancla que realmente sea
 * miembro. Además falla cerrado si CUALQUIER integrante quedó bajo custodia:
 * el contenido relacional es compartido y no puede reescribirse usando como
 * ancla a otro integrante que todavía sea editable.
 */
async function requireWritableCase(anchorPatientId: string, caseId: string): Promise<string> {
  const ownerUserId = await requireClinicalRecordWriteAccess(anchorPatientId);
  const cases = new SqliteRelationalCaseRepository(ownerUserId);
  if (!(await cases.findById(caseId))) notFound();
  const members = new SqliteCaseMemberRepository(ownerUserId);
  if (!(await members.findByCaseAndPatient(caseId, anchorPatientId))) notFound();
  for (const member of await members.listByCase(caseId)) {
    await assertPatientNotInInstitutionalCustody(
      member.toPrimitives().patientId,
      ownerUserId,
    );
  }
  return ownerUserId;
}

async function assertCaseMemberIds(
  ownerUserId: string,
  caseId: string,
  memberIds: string[],
): Promise<void> {
  const allowed = new Set(
    (await new SqliteCaseMemberRepository(ownerUserId).listByCase(caseId)).map(
      (member) => member.toPrimitives().id,
    ),
  );
  if (memberIds.some((memberId) => !allowed.has(memberId))) notFound();
}

/** Crea un caso de pareja con el paciente actual (A) y un segundo paciente (B). */
export async function createParejaCaseAction(patientId: string, formData: FormData): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const secondPatientId = String(formData.get('secondPatientId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  if (!secondPatientId || secondPatientId === patientId) {
    redirect(`/pacientes/${patientId}/vinculos?error=segundo`);
  }
  const patients = new SqlitePatientRepository(ownerUserId);
  const a = await patients.findById(patientId);
  const b = await patients.findById(secondPatientId);
  if (!a || !b) {
    redirect(`/pacientes/${patientId}/vinculos?error=paciente`);
  }
  await assertPatientNotInInstitutionalCustody(secondPatientId, ownerUserId);
  const cases = new SqliteRelationalCaseRepository(ownerUserId);
  const members = new SqliteCaseMemberRepository(ownerUserId);
  const nameA = a!.toPrimitives().fullName;
  const nameB = b!.toPrimitives().fullName;
  const caseId = await getDatabaseAdapter().transaction(async () => {
    const createdCaseId = await new OpenRelationalCase(cases).execute({
      ownerUserId,
      kind: 'pareja',
      title: title || `${nameA} y ${nameB}`,
    });
    const add = new AddCaseMember(cases, members);
    await add.execute({ caseId: createdCaseId, patientId, label: nameA });
    await add.execute({ caseId: createdCaseId, patientId: secondPatientId, label: nameB });
    return createdCaseId;
  });
  revalidatePath(`/pacientes/${patientId}/vinculos`);
  redirect(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Crea un caso de FAMILIA con el paciente actual + uno o más pacientes seleccionados. */
export async function createFamiliaCaseAction(patientId: string, formData: FormData): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const memberIds = formData
    .getAll('memberIds')
    .map((value) => String(value).trim())
    .filter((value) => value && value !== patientId);
  const uniqueIds = [...new Set(memberIds)];
  const title = String(formData.get('title') ?? '').trim();
  if (uniqueIds.length === 0) {
    redirect(`/pacientes/${patientId}/vinculos?error=familia`);
  }
  const patients = new SqlitePatientRepository(ownerUserId);
  const current = await patients.findById(patientId);
  if (!current) redirect(`/pacientes/${patientId}/vinculos?error=paciente`);
  // Se validan TODOS antes de abrir el caso: evita un alta parcial si uno es
  // ajeno, inexistente o está en custodia institucional.
  for (const memberPatientId of uniqueIds) {
    await assertPatientNotInInstitutionalCustody(memberPatientId, ownerUserId);
  }
  const cases = new SqliteRelationalCaseRepository(ownerUserId);
  const members = new SqliteCaseMemberRepository(ownerUserId);
  const nameA = current!.toPrimitives().fullName;
  const caseId = await getDatabaseAdapter().transaction(async () => {
    const createdCaseId = await new OpenRelationalCase(cases).execute({
      ownerUserId,
      kind: 'familia',
      title: title || `Familia de ${nameA}`,
    });
    const add = new AddCaseMember(cases, members);
    await add.execute({ caseId: createdCaseId, patientId, label: nameA });
    for (const memberPatientId of uniqueIds) {
      const p = await patients.findById(memberPatientId);
      if (p) {
        await add.execute({
          caseId: createdCaseId,
          patientId: memberPatientId,
          label: p.toPrimitives().fullName,
        });
      }
    }
    return createdCaseId;
  });
  revalidatePath(`/pacientes/${patientId}/vinculos`);
  redirect(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Añade un paciente como miembro a un caso existente (crecimiento de la familia). */
export async function addCaseMemberAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const newPatientId = String(formData.get('newPatientId') ?? '').trim();
  if (!newPatientId) return;
  const patients = new SqlitePatientRepository(ownerUserId);
  const p = await patients.findById(newPatientId);
  if (!p) return;
  await assertPatientNotInInstitutionalCustody(newPatientId, ownerUserId);
  try {
    await new AddCaseMember(
      new SqliteRelationalCaseRepository(ownerUserId),
      new SqliteCaseMemberRepository(ownerUserId),
    ).execute({ caseId, patientId: newPatientId, label: p.toPrimitives().fullName });
  } catch {
    // Ya es miembro o el caso no admite más: no rompe la página.
  }
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Fija el rol / parentesco de un miembro del caso. */
export async function setMemberRoleAction(
  patientId: string,
  caseId: string,
  memberId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const role = String(formData.get('role') ?? '').trim();
  await new UpdateCaseMember(new SqliteCaseMemberRepository(ownerUserId)).execute({ caseId, memberId, role });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Marca o desmarca a un miembro como paciente identificado del sistema. */
export async function setIdentifiedPatientAction(
  patientId: string,
  caseId: string,
  memberId: string,
  isIdentified: boolean,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new UpdateCaseMember(new SqliteCaseMemberRepository(ownerUserId)).execute({
    caseId,
    memberId,
    isIdentifiedPatient: isIdentified,
  });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Guarda la evaluación del sistema (ciclo vital, estructura, comunicación, motivo). */
export async function setSystemEvalAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).setSystemEval(caseId, {
    lifeCycleStage: String(formData.get('lifeCycleStage') ?? '').trim(),
    structure: String(formData.get('structure') ?? '').trim(),
    communication: String(formData.get('communication') ?? '').trim(),
    systemMotive: String(formData.get('systemMotive') ?? '').trim(),
  });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Guarda los objetivos (sistémicos) del caso. */
export async function setCaseObjectivesAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).setObjectives(
    caseId,
    String(formData.get('objectives') ?? '').trim(),
  );
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Añade un evento a la línea de tiempo del sistema. */
export async function addCaseEventAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const title = String(formData.get('title') ?? '').trim();
  const date = String(formData.get('date') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!title && !date) return;
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).addEvent(caseId, { date, title, note });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Quita un evento de la línea de tiempo. */
export async function removeCaseEventAction(
  patientId: string,
  caseId: string,
  eventId: string,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).removeEvent(caseId, eventId);
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Inserta/actualiza la calidad del vínculo entre dos miembros (mapa de relaciones). */
export async function upsertMemberRelationAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const aMemberId = String(formData.get('aMemberId') ?? '').trim();
  const bMemberId = String(formData.get('bMemberId') ?? '').trim();
  const qualityRaw = String(formData.get('quality') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  if (!aMemberId || !bMemberId || aMemberId === bMemberId || !isMemberRelationQuality(qualityRaw)) return;
  await assertCaseMemberIds(ownerUserId, caseId, [aMemberId, bMemberId]);
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).upsertRelation(caseId, {
    aMemberId,
    bMemberId,
    quality: qualityRaw,
    note,
  });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Quita una relación del mapa. */
export async function removeMemberRelationAction(
  patientId: string,
  caseId: string,
  relationId: string,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new EditCaseProfile(new SqliteRelationalCaseRepository(ownerUserId)).removeRelation(caseId, relationId);
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Fija la política de secretos del caso (obligatoria antes de la 1ª sesión individual). */
export async function setSecretsPolicyAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const policy = String(formData.get('policy') ?? '');
  if (policy !== 'no_secretos' && policy !== 'confidencialidad_limitada') return;
  await new SetSecretsPolicy(new SqliteRelationalCaseRepository(ownerUserId)).execute(caseId, policy as SecretsPolicy);
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Marca otorgado el consentimiento de un miembro (consentimiento doble). */
export async function grantConsentAction(
  patientId: string,
  caseId: string,
  memberId: string,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  await new GrantMemberConsent(new SqliteCaseMemberRepository(ownerUserId)).execute(caseId, memberId);
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Registra el cribado de violencia de un miembro (coercitiva ⇒ contraindica el caso). */
export async function recordScreeningAction(
  patientId: string,
  caseId: string,
  memberId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const status = String(formData.get('status') ?? '');
  if (status !== 'sin_hallazgos' && status !== 'violencia_situacional' && status !== 'violencia_coercitiva') {
    return;
  }
  await new RecordMemberScreening(
    new SqliteRelationalCaseRepository(ownerUserId),
    new SqliteCaseMemberRepository(ownerUserId),
  ).execute({ caseId, memberId, status: status as ScreeningStatus });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Registra una sesión conjunta (compartida) del caso. */
export async function addJointSessionAction(
  patientId: string,
  caseId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const attendees = formData.getAll('attendees').map((v) => String(v).trim()).filter(Boolean);
  if (!content && !title) return;
  await assertCaseMemberIds(ownerUserId, caseId, attendees);
  await new AddJointSession(
    new SqliteRelationalCaseRepository(ownerUserId),
    new SqliteCaseSessionNoteRepository(ownerUserId),
  ).execute({ caseId, title, content, attendees });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/** Registra una sesión individual de un miembro (privada o confidencial). */
export async function addIndividualSessionAction(
  patientId: string,
  caseId: string,
  memberId: string,
  formData: FormData,
): Promise<void> {
  const ownerUserId = await requireWritableCase(patientId, caseId);
  const title = String(formData.get('title') ?? '').trim();
  const content = String(formData.get('content') ?? '').trim();
  const confidential = formData.get('confidential') === 'on';
  if (!content && !title) return;
  await new AddIndividualSession(
    new SqliteRelationalCaseRepository(ownerUserId),
    new SqliteCaseMemberRepository(ownerUserId),
    new SqliteCaseSessionNoteRepository(ownerUserId),
  ).execute({ caseId, memberId, title, content, confidential });
  revalidatePath(`/pacientes/${patientId}/vinculos/${caseId}`);
}

/**
 * Genera el informe FIRMABLE de un miembro (compartido + su individual no
 * confidencial) como patient_report kind='expediente', y lleva a su editor para
 * revisar, firmar y exportar a PDF por la tubería existente.
 */
export async function createCaseMemberReportAction(
  caseId: string,
  memberPatientId: string,
): Promise<void> {
  const ownerUserId = await requireWritableCase(memberPatientId, caseId);
  const patients = new SqlitePatientRepository(ownerUserId);
  // CreateCaseMemberReport (clinical-records, aún SYNC) usa un resolvedor de nombre
  // SÍNCRONO. Como patients.findById ahora es async, pre-resolvemos los nombres de los
  // miembros del caso a un Map y el resolvedor lee del Map (sin escritura cross-context).
  const nameByPatient = new Map<string, string>();
  for (const member of await new SqliteCaseMemberRepository(ownerUserId).listByCase(caseId)) {
    const id = member.toPrimitives().patientId;
    if (nameByPatient.has(id)) continue;
    const p = await patients.findById(id);
    nameByPatient.set(id, p ? p.toPrimitives().fullName : 'Paciente');
  }
  const reportId = await new CreateCaseMemberReport(
    new SqliteRelationalCaseRepository(ownerUserId),
    new SqliteCaseMemberRepository(ownerUserId),
    new SqliteCaseSessionNoteRepository(ownerUserId),
    new SqlitePatientReportRepository(ownerUserId),
  ).execute({
    caseId,
    memberPatientId,
    resolveName: (patientId) => nameByPatient.get(patientId) ?? 'Paciente',
    generatedAt: new Date().toISOString(),
  });
  revalidatePath(`/pacientes/${memberPatientId}/exportar`);
  redirect(`/pacientes/${memberPatientId}/exportar/reportes/${reportId}`);
}
