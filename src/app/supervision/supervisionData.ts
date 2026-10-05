import { notFound, redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import type { SessionContext } from '@/contexts/identity/application/get-session-context/SessionContext';
import type { SupervisionScope } from '@/contexts/identity/domain/SupervisionLink';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { sameConsultorioSql } from '@/shared/infrastructure/persistence/consultorioSql';
import { decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { SqliteReportSignatureRequestRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteReportSignatureRequestRepository';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import type { PatientReportPrimitives } from '@/contexts/clinical-records/domain/PatientReport';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

/**
 * Capa de datos de la vista de supervisión (SOLO LECTURA).
 *
 * Regla crítica: todos los read models filtran por owner_user_id = supervisado
 * y SOLO se puede llegar a un supervisado a través de un vínculo de supervisión
 * vigente del usuario en sesión (requireSupervisionLink). El alcance scope_json
 * decide qué secciones se exponen (notas / historias / pagos).
 */

export interface SupervisorSession {
  userId: string;
  context: SessionContext;
}

// Aislamiento de consultorio (consultorios-spec §3, F4): supervisor y supervisado del
// vínculo `l` deben compartir consultorio (o alguno sin consultorio). Se añade a TODA
// query de supervisión para que un vínculo cross-consultorio no exponga nada.
const SAME_CONSULTORIO = sameConsultorioSql(
  'l.organization_id',
  'l.supervisor_user_id',
  'l.supervised_user_id',
);

// Aislamiento de consultorio en la CUSTODIA (§3.3 + F4). El expediente retenido no tiene
// tratante vivo del cual derivar el consultorio (lo posee el custodio/master, sin
// consultorio), así que el ancla es el TRATANTE HISTÓRICO que el docente supervisó en esa
// asignación `hist`: el docente solo alcanza la custodia si HOY comparte consultorio con
// ese tratante (o alguno no tiene consultorio = master/retrocompat). Cierra la fuga del
// docente que supervisó legítimamente y LUEGO se movió a otro consultorio (revisión
// adversarial F4): la membresía del retirado persiste tras el offboarding, así que el
// consultorio del tratante sigue siendo consultable.
const SAME_CONSULTORIO_CUSTODIA = sameConsultorioSql(
  'hist.organization_id',
  'hist.supervisor_user_id',
  'hist.tratante_user_id',
);

/** Guard de TODO /supervision: professor o miembro con permiso de supervisar. */
export async function requireSupervisor(): Promise<SupervisorSession> {
  const userId = await requireSessionUserId();
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');
  if (!isDesktopEdition() && context.subscription?.expired) redirect('/suscripcion');
  const allowed =
    context.role === 'professor' || context.isSupervisor || context.permissions.canSupervisePatients;
  if (!allowed) redirect(homePathForRole(context.role, context.onboardingCompleted));
  return { userId, context };
}

// ============================ Supervisados ============================

export interface SupervisedSummary {
  userId: string;
  fullName: string;
  email: string;
  scope: SupervisionScope;
  patientCount: number;
  noteCount: number;
  recordCount: number;
}

interface SupervisedRow {
  supervised_user_id: string;
  scope_json: string;
  email: string;
  full_name: string;
  patient_count: number;
  note_count: number;
  record_count: number;
}

function parseScope(json: string): SupervisionScope {
  try {
    const raw = JSON.parse(json || '{}') as Partial<SupervisionScope>;
    return { notas: raw.notas ?? true, historias: raw.historias ?? true, pagos: raw.pagos ?? false };
  } catch {
    return { notas: true, historias: true, pagos: false };
  }
}

export async function listSupervised(supervisorUserId: string): Promise<SupervisedSummary[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT l.supervised_user_id, l.scope_json, u.email,
              COALESCE(p.full_name, '') AS full_name,
              (SELECT COUNT(*) FROM patients pa
                WHERE pa.owner_user_id = l.supervised_user_id AND pa.archived = 0) AS patient_count,
              (SELECT COUNT(*) FROM session_notes n
                WHERE n.owner_user_id = l.supervised_user_id) AS note_count,
              (SELECT COUNT(*) FROM clinical_records r
                WHERE r.owner_user_id = l.supervised_user_id) AS record_count
         FROM supervision_links l
         JOIN users u ON u.id = l.supervised_user_id
         LEFT JOIN practitioner_profile p ON p.user_id = l.supervised_user_id
        WHERE l.supervisor_user_id = ? AND l.revoked_at IS NULL AND u.status = 'activo'
          AND ${SAME_CONSULTORIO}
        ORDER BY l.created_at ASC`,
    [supervisorUserId],
  )) as unknown as SupervisedRow[];

  return rows.map((row) => ({
    userId: row.supervised_user_id,
    fullName: row.full_name,
    email: row.email,
    scope: parseScope(row.scope_json),
    patientCount: row.patient_count,
    noteCount: row.note_count,
    recordCount: row.record_count,
  }));
}

export interface ActiveSupervisionLink {
  supervisedUserId: string;
  supervisedName: string;
  scope: SupervisionScope;
}

/**
 * Verifica que el usuario en sesión supervise a ESE usuario; si no hay vínculo
 * vigente, 404 (no se revela ni que el usuario exista). Devuelve el alcance.
 */
export async function requireSupervisionLink(
  supervisorUserId: string,
  supervisedUserId: string,
): Promise<ActiveSupervisionLink> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT l.scope_json, u.email, COALESCE(p.full_name, '') AS full_name
         FROM supervision_links l
         JOIN users u ON u.id = l.supervised_user_id
         LEFT JOIN practitioner_profile p ON p.user_id = l.supervised_user_id
        WHERE l.supervisor_user_id = ? AND l.supervised_user_id = ?
          AND l.revoked_at IS NULL AND u.status = 'activo'
          AND ${SAME_CONSULTORIO}`,
    [supervisorUserId, supervisedUserId],
  )) as { scope_json: string; email: string; full_name: string } | null;
  if (!row) notFound();
  return {
    supervisedUserId,
    supervisedName: row.full_name || row.email,
    scope: parseScope(row.scope_json),
  };
}

// ============================ Pacientes del supervisado ============================

export interface SupervisedPatient {
  id: string;
  fullName: string;
  gender: string;
  birthDate: string | null;
  consultationReason: string;
  therapyStartDate: string | null;
  noteCount: number;
  recordCount: number;
  activeDiagnosis: string | null;
}

interface PatientRow {
  id: string;
  full_name: string;
  gender: string;
  birth_date: string | null;
  consultation_reason: string;
  therapy_start_date: string | null;
  note_count: number;
  record_count: number;
  active_diagnosis: string | null;
}

const PATIENT_SELECT = `
  SELECT pa.id, pa.full_name, pa.gender, pa.birth_date, pa.consultation_reason, pa.therapy_start_date,
         (SELECT COUNT(*) FROM session_notes n
           WHERE n.patient_id = pa.id AND n.owner_user_id = pa.owner_user_id) AS note_count,
         (SELECT COUNT(*) FROM clinical_records r
           WHERE r.patient_id = pa.id AND r.owner_user_id = pa.owner_user_id) AS record_count,
         (SELECT d.cie11_code || ' · ' || d.cie11_title FROM diagnoses d
           WHERE d.patient_id = pa.id AND d.owner_user_id = pa.owner_user_id AND d.status = 'activo'
           ORDER BY d.diagnosed_at DESC LIMIT 1) AS active_diagnosis
    FROM patients pa`;

function toPatient(row: PatientRow): SupervisedPatient {
  return {
    id: row.id,
    fullName: row.full_name,
    gender: row.gender,
    birthDate: row.birth_date,
    consultationReason: decryptField(row.consultation_reason),
    therapyStartDate: row.therapy_start_date,
    noteCount: row.note_count,
    recordCount: row.record_count,
    activeDiagnosis: row.active_diagnosis,
  };
}

export async function listSupervisedPatients(supervisedUserId: string): Promise<SupervisedPatient[]> {
  const rows = (await getDatabaseAdapter().query(
    `${PATIENT_SELECT} WHERE pa.owner_user_id = ? AND pa.archived = 0 ORDER BY pa.full_name`,
    [supervisedUserId],
  )) as unknown as PatientRow[];
  return rows.map(toPatient);
}

/** Paciente del supervisado; 404 si no existe o pertenece a otro owner. */
export async function requireSupervisedPatient(
  supervisedUserId: string,
  patientId: string,
): Promise<SupervisedPatient> {
  const row = (await getDatabaseAdapter().queryRow(
    `${PATIENT_SELECT} WHERE pa.id = ? AND pa.owner_user_id = ?`,
    [patientId, supervisedUserId],
  )) as PatientRow | null;
  if (!row) notFound();
  return toPatient(row);
}

// ============================ Notas de sesión (scope.notas) ============================

export interface SupervisedNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function listSupervisedNotes(
  supervisedUserId: string,
  patientId: string,
): Promise<SupervisedNote[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT id, title, content, created_at, updated_at FROM session_notes
        WHERE owner_user_id = ? AND patient_id = ?
        ORDER BY updated_at DESC`,
    [supervisedUserId, patientId],
  )) as unknown as NoteRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    // Cifrado at-rest (v3 §1.1): el contenido clínico se descifra al leer.
    content: decryptField(row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function requireSupervisedNote(
  supervisedUserId: string,
  patientId: string,
  noteId: string,
): Promise<SupervisedNote> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT id, title, content, created_at, updated_at FROM session_notes
        WHERE id = ? AND owner_user_id = ? AND patient_id = ?`,
    [noteId, supervisedUserId, patientId],
  )) as NoteRow | null;
  if (!row) notFound();
  return {
    id: row.id,
    title: row.title,
    content: decryptField(row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================ Historias clínicas (scope.historias) ============================

export interface SupervisedRecordSummary {
  id: string;
  title: string;
  templateName: string;
  updatedAt: string;
}

interface RecordRow {
  id: string;
  title: string;
  template_name: string | null;
  updated_at: string;
}

export async function listSupervisedRecords(
  supervisedUserId: string,
  patientId: string,
): Promise<SupervisedRecordSummary[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT r.id, r.title, r.updated_at, t.name AS template_name
         FROM clinical_records r
         LEFT JOIN clinical_record_templates t ON t.id = r.template_id
        WHERE r.owner_user_id = ? AND r.patient_id = ?
        ORDER BY r.updated_at DESC`,
    [supervisedUserId, patientId],
  )) as unknown as RecordRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    templateName: row.template_name ?? 'Formato libre',
    updatedAt: row.updated_at,
  }));
}

// ============================ Pagos del supervisado (scope.pagos) ============================

export interface SupervisedPayment {
  bookingId: string;
  startAt: string;
  price: number;
  feeCharged: number;
  feeReason: string;
  status: string;
  paymentStatus: 'pendiente' | 'pagada';
  paymentMethod: string | null;
  paidAt: string | null;
}

export interface SupervisedPayments {
  currency: string;
  paidTotal: number;
  pendingTotal: number;
  payments: SupervisedPayment[];
}

interface PaymentRow {
  id: string;
  start_at: string;
  price: number;
  fee_charged: number;
  fee_reason: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
}

export async function listSupervisedPayments(
  supervisedUserId: string,
  patientId: string,
): Promise<SupervisedPayments> {
  const db = getDatabaseAdapter();
  const profile = (await db.queryRow('SELECT currency FROM practitioner_profile WHERE user_id = ?', [
    supervisedUserId,
  ])) as { currency: string } | null;

  const rows = (await db.query(
    `SELECT id, start_at, price, fee_charged, fee_reason, status, payment_status, payment_method, paid_at
         FROM bookings
        WHERE owner_user_id = ? AND patient_id = ?
        ORDER BY start_at DESC`,
    [supervisedUserId, patientId],
  )) as unknown as PaymentRow[];

  const payments: SupervisedPayment[] = rows.map((row) => ({
    bookingId: row.id,
    startAt: row.start_at,
    price: row.price,
    feeCharged: row.fee_charged,
    feeReason: row.fee_reason,
    status: row.status,
    paymentStatus: row.payment_status === 'pagada' ? 'pagada' : 'pendiente',
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
  }));

  let paidTotal = 0;
  let pendingTotal = 0;
  for (const payment of payments) {
    const amount = payment.price > 0 ? payment.price : payment.feeCharged;
    if (payment.paymentStatus === 'pagada') paidTotal += amount;
    else if (payment.status !== 'cancelada' || payment.feeCharged > 0) pendingTotal += amount;
  }

  return { currency: profile?.currency ?? 'MXN', paidTotal, pendingTotal, payments };
}

// ===================== Solicitudes de co-firma (bandeja) =====================

export interface SignatureRequestSummary {
  id: string;
  reportId: string;
  patientId: string;
  requesterUserId: string;
  requesterName: string;
  patientName: string;
  reportTitle: string;
  note: string;
  createdAt: string;
}

interface RequestSummaryRow {
  id: string;
  report_id: string;
  patient_id: string;
  requester_user_id: string;
  requester_name: string;
  patient_name: string;
  report_title: string;
  note: string;
  created_at: string;
}

/**
 * Bandeja del supervisor: solicitudes de co-firma PENDIENTES dirigidas a él. El título
 * del reporte y el nombre del paciente se leen acotados al PRACTICANTE (dueño), no en
 * claro de cualquier fila. No expone contenido clínico (solo títulos/nombres).
 */
export async function listSignatureRequestsForSupervisor(
  supervisorUserId: string,
): Promise<SignatureRequestSummary[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT q.id, q.report_id, q.patient_id, q.requester_user_id, q.note, q.created_at,
              COALESCE(NULLIF(rp.full_name, ''), ru.email) AS requester_name,
              COALESCE(pa.full_name, 'Paciente') AS patient_name,
              COALESCE(r.title, 'Reporte') AS report_title
         FROM report_signature_requests q
         JOIN users ru ON ru.id = q.requester_user_id
         LEFT JOIN practitioner_profile rp ON rp.user_id = q.requester_user_id
         LEFT JOIN patients pa ON pa.id = q.patient_id AND pa.owner_user_id = q.requester_user_id
         LEFT JOIN patient_reports r ON r.id = q.report_id AND r.owner_user_id = q.requester_user_id
        WHERE q.supervisor_user_id = ? AND q.status = 'pendiente'
        ORDER BY q.created_at ASC`,
    [supervisorUserId],
  )) as unknown as RequestSummaryRow[];
  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    patientId: row.patient_id,
    requesterUserId: row.requester_user_id,
    requesterName: row.requester_name,
    patientName: row.patient_name,
    reportTitle: row.report_title,
    // La nota se guarda cifrada at-rest (campo clínico de texto libre): descifrar al leer.
    note: row.note ? decryptField(row.note) : '',
    createdAt: row.created_at,
  }));
}

export interface SignatureRequestReview {
  requestId: string;
  requesterUserId: string;
  requesterName: string;
  patientName: string;
  note: string;
  report: PatientReportPrimitives;
}

/**
 * Datos para que el supervisor REVISE y firme una solicitud. Gate triple (mismo
 * espíritu que el caso de uso de firma): la solicitud debe estar pendiente y dirigida
 * a este supervisor, y el vínculo de supervisión debe seguir vigente AHORA. El reporte
 * se lee acotado al practicante (cross-owner) y se descifra al leer. 404 si algo falla
 * (no se revela nada del supervisado).
 */
export async function requireSignatureRequestForReview(
  supervisorUserId: string,
  requestId: string,
): Promise<SignatureRequestReview> {
  const request = await new SqliteReportSignatureRequestRepository().findById(requestId);
  if (!request || !request.isPending() || !request.addressedTo(supervisorUserId)) notFound();
  // Vínculo vigente AHORA y supervisado ACTIVO (fail-closed, criterio v28): no se lee
  // el expediente de una cuenta inhabilitada ni tras revocar el vínculo.
  if (
    !(await new SqliteSupervisorReader().supervisesActive(
      supervisorUserId,
      request.requester(),
      request.organization(),
    ))
  ) {
    notFound();
  }
  const report = await new SqlitePatientReportRepository(request.requester()).findById(request.report());
  if (!report || !report.belongsTo(request.patient())) notFound();

  // Traza obligatoria: el supervisor LEE contenido clínico cross-owner del supervisado
  // (habeas data / Ley 1581), igual que el resto de vistas de supervisión.
  await logRecordAccess(supervisorUserId, request.patient(), 'supervision');

  const names = (await getDatabaseAdapter().queryRow(
    `SELECT COALESCE(NULLIF(rp.full_name, ''), ru.email) AS requester_name,
              COALESCE(pa.full_name, 'Paciente') AS patient_name
         FROM users ru
         LEFT JOIN practitioner_profile rp ON rp.user_id = ru.id
         LEFT JOIN patients pa ON pa.id = ? AND pa.owner_user_id = ?
        WHERE ru.id = ?`,
    [request.patient(), request.requester(), request.requester()],
  )) as { requester_name: string; patient_name: string } | null;

  return {
    requestId: request.requestId(),
    requesterUserId: request.requester(),
    requesterName: names?.requester_name ?? 'Practicante',
    patientName: names?.patient_name ?? 'Paciente',
    note: request.toPrimitives().note,
    report: report.toPrimitives(),
  };
}

// ============ Certificar expedientes en CUSTODIA institucional ============
//
// Edge de la co-firma B: cuando un estudiante se retira y su cartera NO pasa a un
// supervisor (no había supervisor activo), el expediente queda RETENIDO por la
// institución (asignación viva status='institucion', sin tratante). El docente que
// SUPERVISÓ ese caso (consta como supervisor en la HISTORIA de asignaciones) puede
// emitir su propio certificado, firmado con su tarjeta. Acceso de ruptura de cristal
// (break-glass), trazado como 'acceso_cobertura'. Acotado: solo el supervisor histórico
// de ESE expediente, solo pacientes retenidos de SU organización.

export interface HeldPatientSummary {
  patientId: string;
  patientName: string;
}

interface HeldPatientRow {
  patient_id: string;
  patient_name: string;
}

/** Pacientes en custodia institucional de la org que ESTE docente supervisó (historia). */
export async function listHeldPatientsISupervised(
  supervisorUserId: string,
  organizationId: string,
): Promise<HeldPatientSummary[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT DISTINCT p.id AS patient_id, COALESCE(p.full_name, 'Paciente') AS patient_name
         FROM patients p
         JOIN patient_assignments live
           ON live.patient_id = p.id AND live.organization_id = p.organization_id
          AND live.status = 'institucion'
         JOIN patient_assignments hist
           ON hist.patient_id = p.id AND hist.organization_id = p.organization_id
          AND hist.supervisor_user_id = ?
          AND ${SAME_CONSULTORIO_CUSTODIA}
        WHERE p.organization_id = ? AND p.archived = 0
        ORDER BY p.full_name`,
    [supervisorUserId, organizationId],
  )) as unknown as HeldPatientRow[];
  return rows.map((row) => ({ patientId: row.patient_id, patientName: row.patient_name }));
}

export interface HeldPatientForCertification {
  patientId: string;
  patientName: string;
}

/**
 * Gate de certificación en custodia: el paciente debe estar RETENIDO por la institución
 * (asignación viva 'institucion') en ESTA organización, y el docente debe constar como
 * SUPERVISOR en la historia de asignaciones de ese expediente. 404 si no (no se revela
 * nada). Devuelve el nombre del paciente (lectura acotada a la org).
 */
export async function requireHeldPatientForCertification(
  supervisorUserId: string,
  organizationId: string,
  patientId: string,
): Promise<HeldPatientForCertification> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT COALESCE(p.full_name, 'Paciente') AS patient_name
         FROM patients p
         JOIN patient_assignments live
           ON live.patient_id = p.id AND live.organization_id = p.organization_id
          AND live.status = 'institucion'
         JOIN patient_assignments hist
           ON hist.patient_id = p.id AND hist.organization_id = p.organization_id
          AND hist.supervisor_user_id = ?
          AND ${SAME_CONSULTORIO_CUSTODIA}
        WHERE p.id = ? AND p.organization_id = ? AND p.archived = 0
        LIMIT 1`,
    [supervisorUserId, patientId, organizationId],
  )) as { patient_name: string } | null;
  if (!row) notFound();
  return { patientId, patientName: row.patient_name };
}
