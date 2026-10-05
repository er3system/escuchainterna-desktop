'use server';

import { revalidatePath } from 'next/cache';
import { CreatePatient } from '@/contexts/patients/application/create-patient/CreatePatient';
import { CreatePatientMessage } from '@/contexts/patients/application/create-patient/CreatePatientMessage';
import { ArchivePatient } from '@/contexts/patients/application/archive-patient/ArchivePatient';
import {
  ImportPatientsFromCsv,
  type ImportPatientsResult,
} from '@/contexts/patients/application/import-patients-from-csv/ImportPatientsFromCsv';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SqlitePatientAssignmentRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientAssignmentRepository';
import { AssignPatient } from '@/contexts/patients/application/assign-patient/AssignPatient';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqlitePatientNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  requireClinicalRecordAccessUserId,
  requireClinicalRecordWriteAccess,
  requirePatientOperationalAccessContext,
} from '@/shared/infrastructure/auth/dataOwner';
import { revokeAllSharesOfPatient } from '@/shared/infrastructure/auth/patientShares';

/** Campos crudos del formulario de alta (el cliente conserva los valores para confirmar). */
export interface CreatePatientFormInput {
  nombre: string;
  correo: string;
  telefono: string;
  lada: string;
  fechaNacimiento: string;
  genero: string;
  motivoConsulta: string;
  fechaInicioTerapia: string;
  contactoEmergencia: string;
  telefonoEmergencia: string;
  ladaEmergencia: string;
  notas: string;
  etiquetas: string;
  documentoTipo: string;
  documentoNumero: string;
  /** Representante legal (acudiente): nombre, parentesco y documento. Obligatorio para menores. */
  representanteNombre: string;
  representanteParentesco: string;
  representanteDocumento: string;
  /** §5.6: confirma crear pese a un documento duplicado (no bloquea). */
  confirmDuplicate?: boolean;
}

export interface CreatePatientResult {
  ok: boolean;
  patientId?: string;
  patientName?: string;
  error?: string;
  duplicateWarning?: string;
}

export async function createPatientAction(input: CreatePatientFormInput): Promise<CreatePatientResult> {
  const { sessionUserId, ownerUserId, isAssistant } = await requirePatientOperationalAccessContext();
  const nombre = input.nombre.trim();
  const documentNumber = isAssistant ? '' : input.documentoNumero.trim();

  // Propiedad institucional (§1): si el DUEÑO (el tratante, no quien opera) pertenece
  // a una organización con propiedad de expedientes, el paciente nace bajo la org con
  // su asignación de tratante+supervisor. En cuentas individuales nada cambia.
  const ownerContext = await createIdentityUseCases().getSessionContext.get(ownerUserId);
  const institutionalOrgId =
    ownerContext?.organization && ownerContext.organization.patientOwnership === 'institucion'
      ? ownerContext.organization.id
      : null;

  let createdId = '';
  try {
    // Dedupe-avisa (§5.6): avisa (no bloquea) si ya existe ese documento del dueño.
    if (documentNumber && !input.confirmDuplicate) {
      const duplicate = await new SqlitePatientDirectory(ownerUserId).findDuplicateByDocument(documentNumber);
      if (duplicate) {
        return {
          ok: false,
          duplicateWarning: `Ya existe un paciente con este documento: ${duplicate.fullName}. Si es otra persona, confirma para crear de todos modos.`,
        };
      }
    }
    const message = new CreatePatientMessage({
      fullName: nombre,
      email: input.correo.trim(),
      phone: input.telefono.trim(),
      phoneCountryCode: input.lada.trim() || undefined,
      birthDate: isAssistant ? null : input.fechaNacimiento.trim() || null,
      gender: isAssistant ? '' : input.genero.trim(),
      consultationReason: isAssistant ? '' : input.motivoConsulta.trim(),
      therapyStartDate: isAssistant ? null : input.fechaInicioTerapia.trim() || null,
      emergencyContactName: input.contactoEmergencia.trim(),
      emergencyContactPhone: input.telefonoEmergencia.trim(),
      emergencyPhoneCountryCode: input.ladaEmergencia.trim() || undefined,
      // La nota del alta va a la bitácora privada (abajo), no al campo vestigial.
      notes: '',
      tags: isAssistant
        ? []
        : input.etiquetas
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
      documentType: isAssistant ? '' : input.documentoTipo.trim(),
      documentNumber,
      guardianName: isAssistant ? '' : input.representanteNombre.trim(),
      guardianRelationship: isAssistant ? '' : input.representanteParentesco.trim(),
      guardianDocument: isAssistant ? '' : input.representanteDocumento.trim(),
      organizationId: institutionalOrgId,
    });
    const create = () => new CreatePatient(new SqlitePatientRepository(ownerUserId)).create(message);
    const notaInicial = isAssistant ? '' : input.notas.trim();
    // Resuelto FUERA de la transacción (lectura ad-hoc, no es repo de patients).

    // Sede por defecto (Modo Sedes): si el TRATANTE pertenece a un consultorio (sede),
    // el paciente nace "Tratado en" esa sede. Lectura CRUDA de la membresía (no
    // memberConsultorio, que devuelve null en modo compartido —que es justo cuando se
    // muestra la sede—). Inerte en modo aislado; queda como default si luego se activan
    // las Sedes. Editable después desde la ficha.
    const homeConsultorio = (await getDatabaseAdapter().queryRow(
      `SELECT m.consultorio_id AS consultorio_id FROM organization_memberships m WHERE m.user_id = ? LIMIT 1`,
      [ownerUserId],
    )) as { consultorio_id: string | null } | null;
    const homeConsultorioId = homeConsultorio?.consultorio_id ?? null;

    // Atómico (revisión adversarial): paciente + asignación institucional + nota inicial
    // se crean juntos o nada. Antes la nota iba fuera de la transacción: un fallo al
    // insertarla devolvía {ok:false} con el paciente YA creado → riesgo de duplicado al
    // reintentar. Capa de acceso (§1.3): tratante = dueño; supervisor = supervisor activo.
    let newPatientId = '';
    await getDatabaseAdapter().transaction(async () => {
      newPatientId = await create();
      if (homeConsultorioId) {
        await getDatabaseAdapter().execute(
          'UPDATE patients SET consultorio_id = ? WHERE id = ? AND owner_user_id = ?',
          [homeConsultorioId, newPatientId, ownerUserId],
        );
      }
      if (institutionalOrgId) {
        const orgId = institutionalOrgId;
        const supervisor = await new SqliteSupervisorReader().findActiveSupervisor(ownerUserId, orgId);
        await new AssignPatient(new SqlitePatientAssignmentRepository(orgId)).execute({
          patientId: newPatientId,
          organizationId: orgId,
          tratanteUserId: ownerUserId,
          supervisorUserId: supervisor,
          assignedBy: sessionUserId,
          reason: 'alta',
        });
      }
      // La nota escrita en el alta arranca la bitácora privada del paciente
      // (SqlitePatientNoteRepository es de clinical-records, ahora ASYNC: se await).
      if (notaInicial) await new SqlitePatientNoteRepository(ownerUserId).add(newPatientId, notaInicial);
    });
    createdId = newPatientId;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear al paciente.' };
  }
  revalidatePath('/pacientes');
  return { ok: true, patientId: createdId, patientName: nombre };
}

export async function archivePatientAction(patientId: string): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new ArchivePatient(new SqlitePatientRepository(ownerUserId)).archive(patientId);
  // Al sacar al paciente de la consulta, revoca los compartidos de lectura vivos
  // (igual que deletePatientAction): un colega no debe seguir viéndolo archivado.
  await revokeAllSharesOfPatient(patientId, ownerUserId);
  revalidatePath('/pacientes');
}

export async function restorePatientAction(patientId: string): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new ArchivePatient(new SqlitePatientRepository(ownerUserId)).restore(patientId);
  revalidatePath('/pacientes');
}

export async function importPatientsAction(csvContent: string): Promise<ImportPatientsResult> {
  const ownerUserId = await requireClinicalRecordAccessUserId();
  const result = await new ImportPatientsFromCsv(
    new SqlitePatientRepository(ownerUserId),
  ).importFromContent(csvContent);
  if (result.importados > 0) revalidatePath('/pacientes');
  return result;
}
