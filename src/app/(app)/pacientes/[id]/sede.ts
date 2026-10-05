import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface SedeOption {
  id: string;
  name: string;
}

export interface PatientSedeContext {
  /** Consultorios (sedes) vigentes de la organización para elegir. */
  consultorios: SedeOption[];
  /** Sede actual del paciente ("Tratado en"), o null si no tiene. */
  currentConsultorioId: string | null;
  currentConsultorioName: string | null;
}

/**
 * Contexto del "Tratado en" del paciente (Modo Sedes, MS2). SOLO aplica cuando la
 * organización del DUEÑO está en modo 'compartido' (sedes): en ese caso el paciente lleva
 * una sede de atención editable. En 'aislado' (o sin org) devuelve null y la ficha no
 * muestra el campo (el consultorio se deriva del dueño). Acotado al dueño (tratante real).
 */
export async function patientSedeContext(
  patientId: string,
  ownerUserId: string,
): Promise<PatientSedeContext | null> {
  const db = getDatabaseAdapter();
  const org = (await db.queryRow(
    `SELECT o.id AS org_id, o.consultorio_mode AS mode
         FROM organization_memberships m
         JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ? LIMIT 1`,
    [ownerUserId],
  )) as { org_id: string; mode: string } | null;
  if (!org || org.mode !== 'compartido') return null;

  // Map a objetos PLANOS: las filas de node:sqlite tienen prototipo null y no pueden
  // pasarse de un Server Component a un Client Component (TratadoEnCard).
  const consultorios = (
    (await db.query(
      `SELECT id, name FROM consultorios WHERE organization_id = ? AND archived = 0 ORDER BY created_at ASC`,
      [org.org_id],
    )) as unknown as SedeOption[]
  ).map((row) => ({ id: row.id, name: row.name }));

  const current = (await db.queryRow(
    `SELECT p.consultorio_id AS id, c.name AS name
         FROM patients p
         LEFT JOIN consultorios c ON c.id = p.consultorio_id AND c.archived = 0
        WHERE p.id = ? AND p.owner_user_id = ?`,
    [patientId, ownerUserId],
  )) as { id: string | null; name: string | null } | null;
  if (!current) return null;

  return {
    consultorios,
    currentConsultorioId: current.id,
    currentConsultorioName: current.name,
  };
}
