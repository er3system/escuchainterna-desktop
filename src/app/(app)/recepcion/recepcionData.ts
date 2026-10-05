import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { SqliteSchedulingSettings } from '@/contexts/scheduling/infrastructure/persistence/SqliteSchedulingSettings';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import type { AgendaOption, PatientOption } from '../agenda/agendaTypes';

export interface ReceptionProfessional {
  userId: string;
  fullName: string;
  email: string;
}

export interface ReceptionConsultorioGroup {
  consultorioId: string;
  consultorioName: string;
  professionals: ReceptionProfessional[];
}

interface Row {
  consultorio_id: string;
  consultorio_name: string;
  user_id: string | null;
  email: string | null;
  full_name: string;
}

/**
 * Consultorios de la recepción con sus profesionales que ATIENDEN (member_role
 * 'psychologist', cuenta activa). El profesor supervisa pero no atiende, y el master no
 * tiene cartera, así que no aparecen como destino de agenda. Los consultorios llegan ya
 * acotados al alcance de la recepción (resuelto en el servidor), así que el IN es seguro.
 */
export async function listConsultoriosWithProfessionals(
  organizationId: string,
  consultorioIds: string[],
): Promise<ReceptionConsultorioGroup[]> {
  if (consultorioIds.length === 0) return [];
  const placeholders = consultorioIds.map(() => '?').join(', ');
  const rows = (await getDatabaseAdapter().query(
    `SELECT c.id AS consultorio_id, c.name AS consultorio_name,
              u.id AS user_id, u.email, COALESCE(p.full_name, '') AS full_name
         FROM consultorios c
         LEFT JOIN organization_memberships m
                ON m.consultorio_id = c.id AND m.organization_id = c.organization_id
               AND m.member_role = 'psychologist'
         LEFT JOIN users u ON u.id = m.user_id AND u.status = 'activo'
         LEFT JOIN practitioner_profile p ON p.user_id = u.id
        WHERE c.organization_id = ? AND c.archived = 0 AND c.id IN (${placeholders})
        ORDER BY LOWER(c.name), LOWER(full_name)`,
    [organizationId, ...consultorioIds],
  )) as unknown as Row[];

  const groups = new Map<string, ReceptionConsultorioGroup>();
  for (const row of rows) {
    const group =
      groups.get(row.consultorio_id) ??
      ({
        consultorioId: row.consultorio_id,
        consultorioName: row.consultorio_name,
        professionals: [],
      } satisfies ReceptionConsultorioGroup);
    if (row.user_id && row.email) {
      group.professionals.push({
        userId: row.user_id,
        fullName: row.full_name || row.email,
        email: row.email,
      });
    }
    groups.set(row.consultorio_id, group);
  }
  return [...groups.values()];
}

/**
 * NÚCLEO DE SEGURIDAD de la recepción (§5): ¿puede esta recepción agendar para
 * `professionalUserId`? Solo si el profesional es un miembro que ATIENDE (member_role
 * 'psychologist'), con cuenta activa, de la MISMA organización y en uno de los
 * consultorios de la recepción. Función pura respecto a la sesión (recibe el alcance ya
 * resuelto) → testeable. El llamador debe haber validado antes la sesión con
 * requireReception (recepción activa + org habilitada).
 *
 * NOTA (Modo Sedes): este uso de consultorio_id es INDEPENDIENTE de consultorio_mode a
 * propósito. Es un alcance OPERATIVO positivo (a qué sedes se asignó esta recepción de
 * mostrador), no el muro clínico de aislamiento entre psicólogos: no se condiciona al modo.
 */
export async function receptionCanScheduleFor(
  organizationId: string,
  consultorioIds: string[],
  professionalUserId: string,
): Promise<boolean> {
  if (consultorioIds.length === 0) return false;
  const placeholders = consultorioIds.map(() => '?').join(', ');
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT 1 AS hit
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id AND u.status = 'activo'
         JOIN consultorios c ON c.id = m.consultorio_id AND c.archived = 0
        WHERE m.user_id = ? AND m.organization_id = ? AND m.member_role = 'psychologist'
          AND m.consultorio_id IN (${placeholders})
        LIMIT 1`,
    [professionalUserId, organizationId, ...consultorioIds],
  )) as { hit: number } | null;
  return row !== null;
}

export interface ProfessionalBookingContext {
  currency: string;
  agendas: AgendaOption[];
  patients: PatientOption[];
  /** Sedes para elegir la de la sesión (Modo Sedes, MS3); vacío si la org no es 'compartido'. */
  consultorios: { id: string; name: string }[];
}

/**
 * Contexto de agenda de un profesional para que la recepción cree una cita: sus agendas,
 * sus pacientes y su moneda — TODO acotado al profesional (mismo armado que la página de
 * agenda del propio profesional). El llamador DEBE validar antes con receptionCanScheduleFor.
 */
export async function loadProfessionalBookingContext(
  professionalUserId: string,
): Promise<ProfessionalBookingContext> {
  const useCases = createSchedulingUseCases(professionalUserId);
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(professionalUserId);
  const currency = profile?.currency ?? 'MXN';
  const defaultPrice = profile?.defaultPrice ?? 0;
  const defaultModality = (profile?.modality ?? 'ambas') as AgendaOption['modality'];

  const agendas: AgendaOption[] = (await useCases.listAgendas.list()).map((agenda) => ({
    id: agenda.id,
    name: agenda.name,
    color: agenda.color,
    slug: agenda.slug,
    durationMinutes: agenda.durationMinutes,
    price: agenda.paymentOverride ? agenda.paymentOverride.price : defaultPrice,
    currency: agenda.paymentOverride?.currency || currency,
    modality: agenda.locationOverride ? agenda.locationOverride.modality : defaultModality,
    active: agenda.active,
  }));

  const patients: PatientOption[] = (
    await new SearchPatients(new SqlitePatientRepository(professionalUserId)).search(
      new SearchPatientsQuery({}),
    )
  ).map((patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    email: patient.email,
    phone: patient.phone,
  }));

  // Sedes para el selector de sesión (MS3): solo si la org del profesional está en modo
  // 'compartido'. Map a objetos PLANOS (filas de sqlite con prototipo null no serializan).
  const org = (await getDatabaseAdapter().queryRow(
    `SELECT o.id AS org_id, o.consultorio_mode AS mode
         FROM organization_memberships m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ? LIMIT 1`,
    [professionalUserId],
  )) as { org_id: string; mode: string } | null;
  const consultorios =
    org && org.mode === 'compartido'
      ? (
          (await getDatabaseAdapter().query(
            `SELECT id, name FROM consultorios WHERE organization_id = ? AND archived = 0 ORDER BY created_at ASC`,
            [org.org_id],
          )) as unknown as Array<{ id: string; name: string }>
        ).map((row) => ({ id: row.id, name: row.name }))
      : [];

  return { currency, agendas, patients, consultorios };
}
