import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Bitácora de acceso a expedientes (v3 §1.2): cada vista de un área del
 * expediente clínico deja rastro en `record_access_log` (quién, qué paciente,
 * qué área, cuándo). Con throttle de 10 minutos por actor+paciente+área para
 * no llenar la bitácora de ruido por re-renders.
 */

export type RecordAccessArea =
  | 'resumen'
  | 'historia'
  | 'sesiones'
  | 'diagnostico'
  | 'cuestionarios'
  | 'vinculos'
  | 'archivos'
  | 'exportar'
  | 'mapa-familiar'
  | 'consentimiento'
  | 'ajustes'
  | 'mensajes'
  | 'pagos'
  | 'supervision'
  // El asistente de IA, al recuperar contexto clínico de un paciente, deja rastro como
  // cualquier otra vista del expediente (habeas data: "tu dato fue procesado por IA"). No es
  // una pestaña/ruta del expediente → queda FUERA de CLINICAL_AREAS y de parseExpedientePath.
  | 'asistente';

export const RECORD_ACCESS_AREA_LABELS: Record<string, string> = {
  resumen: 'Resumen',
  historia: 'Historia clínica',
  sesiones: 'Notas de sesión',
  diagnostico: 'Diagnóstico',
  cuestionarios: 'Cuestionarios',
  vinculos: 'Vínculos',
  archivos: 'Archivos',
  exportar: 'Exportar',
  'mapa-familiar': 'Mapa familiar',
  consentimiento: 'Consentimiento informado',
  ajustes: 'Ajustes del expediente',
  mensajes: 'Mensajes',
  pagos: 'Pagos',
  supervision: 'Supervisión',
  asistente: 'Asistente IA',
};

/** Áreas que SOLO el profesional puede ver (el rol assistant queda fuera). */
const CLINICAL_AREAS: RecordAccessArea[] = [
  'historia',
  'sesiones',
  'diagnostico',
  'cuestionarios',
  'vinculos',
  'archivos',
  'exportar',
  'mapa-familiar',
  'consentimiento',
  'ajustes',
];

export function isClinicalArea(area: RecordAccessArea): boolean {
  return (CLINICAL_AREAS as string[]).includes(area);
}

/**
 * ¿La ruta del expediente está vedada al rol asistente? (v3 §4). Falla
 * cerrado: si la ruta no se puede interpretar, también se considera vedada.
 * Pura y sin BD: el guard la aplica solo cuando el actor es asistente.
 */
export function isExpedientePathForbiddenForAssistant(pathname: string): boolean {
  const parsed = parseExpedientePath(pathname);
  return !parsed || isClinicalArea(parsed.area);
}

/**
 * Deriva paciente y área desde la ruta del expediente
 * (`/pacientes/<id>` o `/pacientes/<id>/<área>/...`). Null si no es expediente.
 */
export function parseExpedientePath(pathname: string): { patientId: string; area: RecordAccessArea } | null {
  const match = /^\/pacientes\/([^/]+)(?:\/([^/?]+))?/.exec(pathname);
  if (!match) return null;
  const patientId = decodeURIComponent(match[1] ?? '');
  if (!patientId || ['nuevo', 'importar', 'exportar'].includes(patientId)) return null;
  const segment = match[2] ?? '';
  if (segment === '' || segment === 'resumen') return { patientId, area: 'resumen' };
  const area = (Object.keys(RECORD_ACCESS_AREA_LABELS) as RecordAccessArea[]).find((item) => item === segment);
  // Cualquier nueva subruta de paciente debe clasificarse expresamente antes
  // de quedar disponible al asistente. Así una futura área clínica no hereda
  // por accidente los permisos operativos de Resumen.
  if (!area || area === 'asistente' || area === 'supervision') return null;
  return { patientId, area };
}

const THROTTLE_MS = 10 * 60 * 1000;

/**
 * Registra un acceso al expediente. Throttle: máximo 1 evento por
 * actor+paciente+área cada 10 minutos.
 */
export async function logRecordAccess(
  actorUserId: string,
  patientId: string,
  area: RecordAccessArea,
  action = 'ver',
): Promise<void> {
  const db = getDatabaseAdapter();
  const since = new Date(Date.now() - THROTTLE_MS).toISOString();
  // El throttle es por actor+paciente+área+ACCIÓN: una entrada 'ver' previa JAMÁS
  // debe suprimir un registro crítico de auditoría 'acceso_cobertura' (§2.3) ni
  // viceversa. Cada tipo de acción se traza por separado.
  const recent = await db.queryRow<{ id: string }>(
    `SELECT id FROM record_access_log
        WHERE actor_user_id = ? AND patient_id = ? AND area = ? AND action = ? AND created_at >= ?
        LIMIT 1`,
    [actorUserId, patientId, area, action, since],
  );
  if (recent) return;

  await db.execute(
    `INSERT INTO record_access_log (id, actor_user_id, patient_id, area, action, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), actorUserId, patientId, area, action, new Date().toISOString()],
  );
}

// ============================ Consultas (read models) ============================

export interface RecordAccessEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  actorName: string;
  patientId: string;
  patientName: string;
  area: string;
  action: string;
  createdAt: string;
}

export interface RecordAccessFilters {
  /** Texto a buscar en correo o nombre del actor. */
  actorQuery?: string;
  /** Texto a buscar en el nombre del paciente. */
  patientQuery?: string;
  /** Fecha mínima (AAAA-MM-DD). */
  from?: string;
  /** Fecha máxima (AAAA-MM-DD, inclusive). */
  to?: string;
  /** Limita a UN paciente concreto. */
  patientId?: string;
  /** Limita a pacientes de este dueño (vista del psicólogo). */
  patientOwnerUserId?: string;
  /**
   * Limita a la actividad de un equipo (vista de organización): accesos hechos
   * POR estos usuarios o SOBRE pacientes de estos usuarios.
   */
  memberUserIds?: string[];
  limit?: number;
}

interface AccessRow {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  actor_name: string | null;
  patient_id: string;
  patient_name: string | null;
  area: string;
  action: string;
  created_at: string;
}

export async function searchRecordAccess(filters: RecordAccessFilters = {}): Promise<RecordAccessEntry[]> {
  if (filters.memberUserIds && filters.memberUserIds.length === 0) return [];

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.patientId) {
    conditions.push('l.patient_id = ?');
    params.push(filters.patientId);
  }
  if (filters.patientOwnerUserId) {
    conditions.push('p.owner_user_id = ?');
    params.push(filters.patientOwnerUserId);
  }
  if (filters.memberUserIds && filters.memberUserIds.length > 0) {
    const placeholders = filters.memberUserIds.map(() => '?').join(', ');
    conditions.push(`(l.actor_user_id IN (${placeholders}) OR p.owner_user_id IN (${placeholders}))`);
    params.push(...filters.memberUserIds, ...filters.memberUserIds);
  }
  if (filters.actorQuery && filters.actorQuery.trim() !== '') {
    const like = `%${filters.actorQuery.trim()}%`;
    conditions.push("(u.email LIKE ? OR COALESCE(pr.full_name, '') LIKE ?)");
    params.push(like, like);
  }
  if (filters.patientQuery && filters.patientQuery.trim() !== '') {
    conditions.push("COALESCE(p.full_name, '') LIKE ?");
    params.push(`%${filters.patientQuery.trim()}%`);
  }
  if (filters.from && filters.from.trim() !== '') {
    conditions.push('l.created_at >= ?');
    params.push(filters.from.trim());
  }
  if (filters.to && filters.to.trim() !== '') {
    // Inclusive: cualquier hora dentro del día indicado.
    conditions.push('l.created_at <= ?');
    params.push(`${filters.to.trim()}T23:59:59.999Z`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);

  const rows = await getDatabaseAdapter().query<AccessRow>(
    `SELECT l.id, l.actor_user_id, l.patient_id, l.area, l.action, l.created_at,
              u.email AS actor_email,
              pr.full_name AS actor_name,
              p.full_name AS patient_name
         FROM record_access_log l
         LEFT JOIN users u ON u.id = l.actor_user_id
         LEFT JOIN practitioner_profile pr ON pr.user_id = l.actor_user_id
         LEFT JOIN patients p ON p.id = l.patient_id
        ${where}
        ORDER BY l.created_at DESC
        LIMIT ${limit}`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email ?? '',
    actorName: row.actor_name ?? '',
    patientId: row.patient_id,
    patientName: row.patient_name ?? '',
    area: row.area,
    action: row.action,
    createdAt: row.created_at,
  }));
}

/** Últimos accesos a UN paciente del dueño en sesión (sección del expediente). */
export function listPatientAccessLog(
  ownerUserId: string,
  patientId: string,
  limit = 10,
): Promise<RecordAccessEntry[]> {
  return searchRecordAccess({ patientId, patientOwnerUserId: ownerUserId, limit });
}
