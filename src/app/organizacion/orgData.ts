import { redirect } from 'next/navigation';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { toAccessPolicy, type AccessPolicy } from '@/contexts/identity/domain/value-objects/accessPolicy';
import type { SupervisionScope } from '@/contexts/identity/domain/SupervisionLink';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

/**
 * Datos del hub de organización (solo lectura + guard del maestro).
 * Las MUTACIONES van por casos de uso de identity; aquí solo hay read models
 * agregados del equipo (números, jamás contenido clínico) y el borrado de
 * vínculos de supervisión (sin caso de uso porque el repo no expone delete).
 */

export interface OrgHubOrganization {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logoPath: string | null;
  /** Servicio sin costo (v3 §3): consultas gratuitas para los pacientes de todo el equipo. */
  freeService: boolean;
  /**
   * Propiedad de los expedientes (cuentas institucionales §1): 'individual' = del
   * profesional; 'institucion' = de la organización (pacientes nuevos bajo la org).
   */
  patientOwnership: 'individual' | 'institucion';
  /** Preset base de acceso entre miembros (§2.2): estricto | intermedio | cobertura. */
  accessPolicy: AccessPolicy;
  /** Si los profesores pueden ampliar el acceso de sus supervisados (§2.1). */
  professorCanWiden: boolean;
  /** Recepción multi-consultorio habilitada (consultorios §5). */
  receptionMultiConsultorio: boolean;
  /** Modo de consultorios (Modo Sedes): 'aislado' = muro clínico; 'compartido' = sedes/etiquetas. */
  consultorioMode: 'aislado' | 'compartido';
}

export interface OrgMasterSession {
  userId: string;
  organization: OrgHubOrganization;
}

/** Guard de TODO /organizacion: sesión válida, rol org_master y su organización. */
export async function requireOrgMaster(): Promise<OrgMasterSession> {
  const userId = await requireSessionUserId();
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');
  if (!isDesktopEdition() && context.subscription?.expired) redirect('/suscripcion');
  if (context.role !== 'org_master') {
    redirect(homePathForRole(context.role, context.onboardingCompleted));
  }

  const organization = context.organization ?? (await findOrganizationByMaster(userId));
  if (!organization) redirect('/inicio');
  return { userId, organization };
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logo_path: string | null;
  free_service: number;
  patient_ownership: string;
  access_policy: string;
  professor_can_widen: number;
  reception_multi_consultorio: number;
  consultorio_mode: string;
}

function toOrgHubOrganization(row: OrganizationRow): OrgHubOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    logoPath: row.logo_path,
    freeService: row.free_service === 1,
    patientOwnership: row.patient_ownership === 'institucion' ? 'institucion' : 'individual',
    accessPolicy: toAccessPolicy(row.access_policy),
    professorCanWiden: row.professor_can_widen === 1,
    receptionMultiConsultorio: row.reception_multi_consultorio === 1,
    consultorioMode: row.consultorio_mode === 'compartido' ? 'compartido' : 'aislado',
  };
}

const ORG_COLUMNS =
  'id, name, slug, kind, logo_path, free_service, patient_ownership, access_policy, professor_can_widen, reception_multi_consultorio, consultorio_mode';

async function findOrganizationByMaster(userId: string): Promise<OrgHubOrganization | null> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT ${ORG_COLUMNS} FROM organizations WHERE master_user_id = ?`,
    [userId],
  )) as OrganizationRow | null;
  return row ? toOrgHubOrganization(row) : null;
}

/** Relee la organización (para ajustes/branding tras guardar). */
export async function getOrganization(organizationId: string): Promise<OrgHubOrganization | null> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT ${ORG_COLUMNS} FROM organizations WHERE id = ?`,
    [organizationId],
  )) as OrganizationRow | null;
  return row ? toOrgHubOrganization(row) : null;
}

// ============================ Consultorios (§2) ============================

export interface OrgConsultorio {
  id: string;
  name: string;
}

interface ConsultorioRow {
  id: string;
  name: string;
}

/** Consultorios NO archivados de la organización (sub-unidades, §2). */
export async function listConsultorios(organizationId: string): Promise<OrgConsultorio[]> {
  const rows = (await getDatabaseAdapter().query(
    'SELECT id, name FROM consultorios WHERE organization_id = ? AND archived = 0 ORDER BY created_at ASC',
    [organizationId],
  )) as unknown as ConsultorioRow[];
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

// ============================ Recepción multi-consultorio (§5) ============================

export interface OrgReceptionist {
  userId: string;
  fullName: string;
  email: string;
  /** 'activo' | 'suspendido' (se desactiva igual que un asistente). */
  status: string;
  consultorios: OrgConsultorio[];
}

interface ReceptionistRow {
  assistant_user_id: string;
  email: string;
  status: string;
  full_name: string;
  consultorio_id: string;
  consultorio_name: string | null;
}

/** Recepciones de la organización con sus consultorios (para la gestión del maestro). */
export async function listReceptionists(organizationId: string): Promise<OrgReceptionist[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT rc.assistant_user_id, u.email, u.status,
              COALESCE(p.full_name, '') AS full_name,
              rc.consultorio_id, c.name AS consultorio_name
         FROM reception_consultorios rc
         JOIN users u ON u.id = rc.assistant_user_id
         LEFT JOIN practitioner_profile p ON p.user_id = rc.assistant_user_id
         LEFT JOIN consultorios c ON c.id = rc.consultorio_id AND c.archived = 0
        WHERE rc.organization_id = ?
        ORDER BY full_name, c.name`,
    [organizationId],
  )) as unknown as ReceptionistRow[];

  const byUser = new Map<string, OrgReceptionist>();
  for (const row of rows) {
    const existing = byUser.get(row.assistant_user_id);
    const entry =
      existing ??
      ({
        userId: row.assistant_user_id,
        fullName: row.full_name || row.email,
        email: row.email,
        status: row.status,
        consultorios: [],
      } satisfies OrgReceptionist);
    // Solo se listan consultorios vigentes (no archivados); el JOIN deja name NULL si no.
    if (row.consultorio_name) entry.consultorios.push({ id: row.consultorio_id, name: row.consultorio_name });
    byUser.set(row.assistant_user_id, entry);
  }
  return [...byUser.values()];
}

// ============================ Miembros ============================

export interface OrgMember {
  userId: string;
  fullName: string;
  email: string;
  /** Tarjeta profesional del miembro: el maestro la ve para saber quién puede firmar/certificar. */
  professionalLicense: string;
  memberRole: 'master' | 'professor' | 'psychologist';
  status: 'activo' | 'suspendido';
  permissions: MembershipPermissionsPrimitives;
  patientCount: number;
  /** Consultorio del miembro (null = master / sin consultorio). Fase 1: solo pertenencia. */
  consultorioId: string | null;
  consultorioName: string | null;
  createdAt: string;
}

interface MemberRow {
  user_id: string;
  member_role: string;
  permissions_json: string;
  created_at: string;
  email: string;
  status: string;
  full_name: string;
  professional_license: string;
  patient_count: number;
  consultorio_id: string | null;
  consultorio_name: string | null;
}

export async function listOrganizationMembers(organizationId: string): Promise<OrgMember[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT m.user_id, m.member_role, m.permissions_json, m.created_at, m.consultorio_id,
              u.email, u.status,
              COALESCE(p.full_name, '') AS full_name,
              COALESCE(p.professional_license, '') AS professional_license,
              c.name AS consultorio_name,
              (SELECT COUNT(*) FROM patients pa
                WHERE pa.owner_user_id = m.user_id AND pa.archived = 0) AS patient_count
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN practitioner_profile p ON p.user_id = m.user_id
         LEFT JOIN consultorios c ON c.id = m.consultorio_id AND c.archived = 0
        WHERE m.organization_id = ?
        ORDER BY CASE m.member_role WHEN 'master' THEN 0 WHEN 'professor' THEN 1 ELSE 2 END,
                 m.created_at ASC`,
    [organizationId],
  )) as unknown as MemberRow[];

  return rows.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    professionalLicense: row.professional_license,
    memberRole: (['master', 'professor', 'psychologist'].includes(row.member_role)
      ? row.member_role
      : 'psychologist') as OrgMember['memberRole'],
    status: row.status === 'suspendido' ? 'suspendido' : 'activo',
    permissions: MembershipPermissions.fromJson(row.permissions_json).toPrimitives(),
    patientCount: row.patient_count,
    consultorioId: row.consultorio_id ?? null,
    consultorioName: row.consultorio_name ?? null,
    createdAt: row.created_at,
  }));
}

// ============================ Vínculos de supervisión ============================

export interface OrgSupervisionLink {
  id: string;
  supervisorUserId: string;
  supervisorName: string;
  supervisedUserId: string;
  supervisedName: string;
  scope: SupervisionScope;
  createdAt: string;
}

interface LinkRow {
  id: string;
  supervisor_user_id: string;
  supervised_user_id: string;
  scope_json: string;
  created_at: string;
  supervisor_name: string;
  supervised_name: string;
}

function parseScope(json: string): SupervisionScope {
  try {
    const raw = JSON.parse(json || '{}') as Partial<SupervisionScope>;
    return { notas: raw.notas ?? true, historias: raw.historias ?? true, pagos: raw.pagos ?? false };
  } catch {
    return { notas: true, historias: true, pagos: false };
  }
}

export async function listOrgSupervisionLinks(organizationId: string): Promise<OrgSupervisionLink[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT l.id, l.supervisor_user_id, l.supervised_user_id, l.scope_json, l.created_at,
              COALESCE(ps.full_name, us.email) AS supervisor_name,
              COALESCE(pe.full_name, ue.email) AS supervised_name
         FROM supervision_links l
         JOIN users us ON us.id = l.supervisor_user_id
         JOIN users ue ON ue.id = l.supervised_user_id
         LEFT JOIN practitioner_profile ps ON ps.user_id = l.supervisor_user_id
         LEFT JOIN practitioner_profile pe ON pe.user_id = l.supervised_user_id
        WHERE l.organization_id = ? AND l.revoked_at IS NULL
        ORDER BY l.created_at ASC`,
    [organizationId],
  )) as unknown as LinkRow[];

  return rows.map((row) => ({
    id: row.id,
    supervisorUserId: row.supervisor_user_id,
    supervisorName: row.supervisor_name,
    supervisedUserId: row.supervised_user_id,
    supervisedName: row.supervised_name,
    scope: parseScope(row.scope_json),
    createdAt: row.created_at,
  }));
}

// ============================ Expedientes institucionales (§1, §3) ============================

export interface OrgInstitutionalPatient {
  patientId: string;
  patientName: string;
  /** Dueño operativo actual (tratante) — owner_user_id del paciente. */
  ownerUserId: string;
  tratanteName: string;
  supervisorName: string | null;
  /** 'institucion' = retenido por la institución, sin tratante asignado (§3.3). */
  heldByInstitution: boolean;
  /** Consultorio del paciente = el del dueño/tratante (consultorios §3). null = sin consultorio. */
  consultorioId: string | null;
  consultorioName: string | null;
}

interface InstitutionalPatientRow {
  id: string;
  full_name: string;
  owner_user_id: string;
  tratante_name: string | null;
  supervisor_name: string | null;
  assignment_status: string | null;
  consultorio_id: string | null;
  consultorio_name: string | null;
}

/**
 * Pacientes cuyo expediente PERTENECE a la organización (§1). Muestra el tratante
 * operativo actual (owner_user_id) y, de la asignación viva, el supervisor y si está
 * retenido por la institución. Solo metadatos de custodia — jamás contenido clínico.
 */
export async function listInstitutionalPatients(
  organizationId: string,
  /**
   * Filtro opcional por consultorio del dueño (consultorios §3). undefined = todos.
   * NOTA (Modo Sedes): es un filtro de VISUALIZACIÓN del maestro (que ve todo), no un
   * muro de aislamiento, así que es INDEPENDIENTE de consultorio_mode (no se condiciona).
   */
  consultorioId?: string,
): Promise<OrgInstitutionalPatient[]> {
  const params: string[] = [organizationId];
  let consultorioFilter = '';
  if (consultorioId) {
    // El consultorio del paciente se deriva del de su dueño (om.consultorio_id).
    consultorioFilter = ' AND om.consultorio_id = ?';
    params.push(consultorioId);
  }
  const rows = (await getDatabaseAdapter().query(
    `SELECT pa.id, pa.full_name, pa.owner_user_id,
              COALESCE(pt.full_name, ut.email) AS tratante_name,
              COALESCE(ps.full_name, us.email) AS supervisor_name,
              a.status AS assignment_status,
              om.consultorio_id AS consultorio_id,
              c.name AS consultorio_name
         FROM patients pa
         LEFT JOIN users ut ON ut.id = pa.owner_user_id
         LEFT JOIN practitioner_profile pt ON pt.user_id = pa.owner_user_id
         LEFT JOIN patient_assignments a
                ON a.patient_id = pa.id AND a.organization_id = pa.organization_id AND a.status != 'reasignada'
         LEFT JOIN users us ON us.id = a.supervisor_user_id
         LEFT JOIN practitioner_profile ps ON ps.user_id = a.supervisor_user_id
         LEFT JOIN organization_memberships om
                ON om.user_id = pa.owner_user_id AND om.organization_id = pa.organization_id
         LEFT JOIN consultorios c ON c.id = om.consultorio_id AND c.archived = 0
        WHERE pa.organization_id = ? AND pa.archived = 0${consultorioFilter}
        ORDER BY LOWER(pa.full_name) ASC`,
    params,
  )) as unknown as InstitutionalPatientRow[];

  return rows.map((row) => ({
    patientId: row.id,
    patientName: row.full_name,
    ownerUserId: row.owner_user_id,
    tratanteName: row.tratante_name ?? '—',
    supervisorName: row.supervisor_name,
    heldByInstitution: row.assignment_status === 'institucion',
    consultorioId: row.consultorio_id,
    consultorioName: row.consultorio_name,
  }));
}

/**
 * Revoca un vínculo (soft) SOLO si pertenece a la organización del maestro. No
 * se borra para conservar historial; el read path ignora los revocados. Re-crear
 * el mismo vínculo lo re-activa (save() pone revoked_at = NULL).
 */
export async function removeSupervisionLink(organizationId: string, linkId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    `UPDATE supervision_links SET revoked_at = ?
        WHERE id = ? AND organization_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), linkId, organizationId],
  );
}

/**
 * Revoca TODOS los vínculos vivos en los que el usuario participa (como
 * supervisor o supervisado). Se usa al dar de baja a un miembro: corta de
 * inmediato la lectura de supervisión y evita que una futura reactivación
 * resucite vínculos viejos. El read path además exige supervisado activo.
 */
export async function revokeSupervisionLinksForMember(userId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    `UPDATE supervision_links SET revoked_at = ?
        WHERE (supervisor_user_id = ? OR supervised_user_id = ?) AND revoked_at IS NULL`,
    [new Date().toISOString(), userId, userId],
  );
}

// ============================ Liquidación interna (v3 §3) ============================

/** Total cobrado por un miembro en UNA moneda dentro del mes. */
export interface LiquidationCurrencyTotal {
  currency: string;
  paidSessions: number;
  totalCharged: number;
  /** Monto informativo que corresponde a la organización según su % de liquidación. */
  organizationShare: number;
}

export interface MemberLiquidationRow {
  userId: string;
  fullName: string;
  email: string;
  memberRole: 'master' | 'professor' | 'psychologist';
  liquidationPercent: number;
  totals: LiquidationCurrencyTotal[];
}

export interface OrgLiquidation {
  /** Mes consultado en formato AAAA-MM. */
  month: string;
  members: MemberLiquidationRow[];
  /** Agregado por moneda de todo el equipo. */
  totalsByCurrency: LiquidationCurrencyTotal[];
}

interface LiquidationQueryRow {
  owner_user_id: string;
  currency: string;
  paid_sessions: number;
  total_charged: number;
}

/**
 * Liquidación interna INFORMATIVA del mes: sesiones cobradas por miembro,
 * total por moneda y el monto que correspondería a la organización según el
 * porcentaje de liquidación interna configurado en los permisos del miembro.
 * No mueve dinero: es un reporte para acuerdos internos org ↔ profesional.
 */
export async function getOrgLiquidation(organizationId: string, month: string): Promise<OrgLiquidation> {
  const members = await listOrganizationMembers(organizationId);
  const result: OrgLiquidation = { month, members: [], totalsByCurrency: [] };
  if (members.length === 0) return result;

  const ids = members.map((member) => member.userId);
  const placeholders = ids.map(() => '?').join(', ');

  // Mes del COBRO (paid_at); si una fila histórica no lo tiene, usa la fecha de la sesión.
  const rows = (await getDatabaseAdapter().query(
    `SELECT owner_user_id,
              COALESCE(NULLIF(currency, ''), 'MXN') AS currency,
              COUNT(*) AS paid_sessions,
              COALESCE(SUM(price), 0) AS total_charged
         FROM bookings
        WHERE owner_user_id IN (${placeholders})
          AND payment_status = 'pagada'
          AND substr(COALESCE(paid_at, start_at), 1, 7) = ?
        GROUP BY owner_user_id, COALESCE(NULLIF(currency, ''), 'MXN')`,
    [...ids, month],
  )) as unknown as LiquidationQueryRow[];

  const byOwner = new Map<string, LiquidationQueryRow[]>();
  for (const row of rows) {
    const list = byOwner.get(row.owner_user_id) ?? [];
    list.push(row);
    byOwner.set(row.owner_user_id, list);
  }

  const aggregate = new Map<string, LiquidationCurrencyTotal>();
  for (const member of members) {
    const percent = member.permissions.retentionPercent;
    const totals: LiquidationCurrencyTotal[] = (byOwner.get(member.userId) ?? [])
      .map((row) => ({
        currency: row.currency,
        paidSessions: row.paid_sessions,
        totalCharged: row.total_charged,
        organizationShare: (row.total_charged * percent) / 100,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    for (const total of totals) {
      const current = aggregate.get(total.currency) ?? {
        currency: total.currency,
        paidSessions: 0,
        totalCharged: 0,
        organizationShare: 0,
      };
      current.paidSessions += total.paidSessions;
      current.totalCharged += total.totalCharged;
      current.organizationShare += total.organizationShare;
      aggregate.set(total.currency, current);
    }

    result.members.push({
      userId: member.userId,
      fullName: member.fullName,
      email: member.email,
      memberRole: member.memberRole,
      liquidationPercent: percent,
      totals,
    });
  }

  result.totalsByCurrency = [...aggregate.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  return result;
}
