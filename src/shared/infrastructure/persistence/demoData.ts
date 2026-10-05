import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { encryptField } from '../crypto/FieldEncryption';
import {
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_TITLE,
} from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';
import { documentBlindIndex } from './patientPiiEncryption';

/**
 * Datos demo de relleno para las cuentas de prueba: ~5 pacientes por cada
 * profesional que atiende, con agenda, sesiones en varios estados (completada,
 * agendada, inasistencia), pagos, notas cortas y algún diagnóstico CIE-11.
 *
 * Objetivo: poder recorrer cada función con datos realistas. NO pretende ser
 * clínicamente exhaustivo. Idempotente vía marker en platform_settings; corre
 * dentro de runSeed ANTES del pase de cifrado, así las notas quedan cifradas.
 */

const DEMO_MARKER = 'demo_data';
const DEMO_VERSION = 'v1';
// Caso rico de Andrés Mejía: marcador propio, INDEPENDIENTE del de los pacientes
// thin, para poder enriquecer sin re-sembrarlos (que duplicaría). Aditivo e idempotente.
const DEMO_RICH_MARKER = 'demo_rich_case';
const DEMO_RICH_VERSION = 'v1';
const SESSION_PRICE_COP = 90000;
const NO_SHOW_FEE_COP = 45000;

/** Cuentas demo que reciben los pacientes de relleno (y el caso rico de Andrés). */
const DEMO_ACCOUNTS: Array<{ email: string; charges: boolean }> = [
  { email: 'admin@demo.test', charges: true },
  { email: 'maestro@uni-demo.test', charges: true },
  { email: 'estudiante1@uni-demo.test', charges: true },
  { email: 'estudiante2@uni-demo.test', charges: false }, // pagos deshabilitados
  { email: 'psicologa@demo.test', charges: true },
];

interface DemoSession {
  offsetDays: number; // negativo = pasado, positivo = futuro
  hour: number;
  status: 'completada' | 'agendada' | 'confirmada' | 'inasistencia';
  modality: 'presencial' | 'virtual';
  paid: boolean;
  feeNoShow?: boolean;
}

interface DemoNote {
  title: string;
  content: string;
  offsetDays: number;
}

interface DemoPatient {
  fullName: string;
  gender: string;
  age: number;
  reason: string;
  tags: string[];
  diagnosis?: { code: string; title: string; notes: string };
  sessions: DemoSession[];
  notes: DemoNote[];
}

/** Cinco pacientes que, en conjunto, ejercitan todos los estados de la app. */
const DEMO_PATIENTS: DemoPatient[] = [
  {
    fullName: 'Mariana Restrepo',
    gender: 'femenino',
    age: 28,
    reason: 'Ansiedad relacionada con el trabajo y dificultad para dormir.',
    tags: ['Primera vez'],
    diagnosis: {
      code: '6B00',
      title: 'Trastorno de ansiedad generalizada',
      notes: 'Preocupación persistente y tensión; se inicia trabajo en regulación emocional.',
    },
    sessions: [
      { offsetDays: -21, hour: 10, status: 'completada', modality: 'presencial', paid: true },
      { offsetDays: -7, hour: 10, status: 'completada', modality: 'virtual', paid: true },
      { offsetDays: 4, hour: 10, status: 'agendada', modality: 'presencial', paid: false },
    ],
    notes: [
      {
        title: 'Primera sesión — encuadre',
        content:
          'Se establece el encuadre y se exploran los motivos de consulta. Refiere preocupación constante por el desempeño laboral e insomnio de conciliación. Se acuerda registro de pensamientos antes de dormir.',
        offsetDays: -21,
      },
      {
        title: 'Seguimiento — higiene del sueño',
        content:
          'Reporta mejoría parcial del sueño con la rutina acordada. Persiste rumiación nocturna. Se introduce respiración diafragmática.',
        offsetDays: -7,
      },
    ],
  },
  {
    fullName: 'Carlos Quintero',
    gender: 'masculino',
    age: 35,
    reason: 'Síntomas depresivos tras una separación reciente.',
    tags: ['Pago anticipado'],
    diagnosis: {
      code: '6A70',
      title: 'Trastorno depresivo, episodio único',
      notes: 'Ánimo bajo y anhedonia desde hace dos meses; sin ideación suicida.',
    },
    sessions: [
      { offsetDays: -14, hour: 12, status: 'completada', modality: 'presencial', paid: true },
      { offsetDays: -3, hour: 12, status: 'completada', modality: 'presencial', paid: true },
    ],
    notes: [
      {
        title: 'Evaluación inicial',
        content:
          'Proceso de duelo por ruptura. Activación conductual como primera línea: se planifican actividades gratificantes para la semana.',
        offsetDays: -14,
      },
    ],
  },
  {
    fullName: 'Valentina Gómez',
    gender: 'femenino',
    age: 19,
    reason: 'Ataques de pánico recurrentes antes de los exámenes.',
    tags: ['Estudiante'],
    diagnosis: {
      code: '6B01',
      title: 'Trastorno de pánico',
      notes: 'Crisis con síntomas somáticos; psicoeducación sobre el ciclo del pánico.',
    },
    sessions: [
      { offsetDays: -10, hour: 16, status: 'completada', modality: 'virtual', paid: true },
      { offsetDays: -2, hour: 16, status: 'inasistencia', modality: 'virtual', paid: false, feeNoShow: true },
    ],
    notes: [
      {
        title: 'Psicoeducación del pánico',
        content:
          'Se explica el ciclo del pánico y el rol de la hiperventilación. Tarea: registro de crisis con intensidad 0-10.',
        offsetDays: -10,
      },
    ],
  },
  {
    fullName: 'Andrés Mejía',
    gender: 'masculino',
    age: 42,
    reason: 'Estrés laboral y signos de agotamiento profesional.',
    tags: ['Aseguradora'],
    sessions: [{ offsetDays: -5, hour: 9, status: 'completada', modality: 'presencial', paid: false }],
    notes: [
      {
        title: 'Primera sesión',
        content:
          'Carga laboral sostenida con síntomas de desgaste. Se evalúan límites y se introducen pausas activas. Pendiente de pago.',
        offsetDays: -5,
      },
    ],
  },
  {
    fullName: 'Lucía Naranjo',
    gender: 'femenino',
    age: 31,
    reason: 'Acompañamiento en proceso de duelo por pérdida familiar.',
    tags: ['VIP'],
    sessions: [{ offsetDays: 6, hour: 11, status: 'agendada', modality: 'presencial', paid: false }],
    notes: [],
  },
];

function atDay(offsetDays: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function birthDateFor(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-05-15`;
}

/** Una agenda activa por dueño (crea "Sesión individual" si no tiene ninguna). */
function ensureAgendaFor(db: DatabaseSync, ownerUserId: string): string {
  const existing = db
    .prepare('SELECT id FROM agendas WHERE owner_user_id = ? AND active = 1 LIMIT 1')
    .get(ownerUserId) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO agendas (id, name, color, slug, duration_minutes, slot_interval_minutes, min_booking_hours,
       active, created_at, owner_user_id, currency)
     VALUES (?, 'Sesión individual', '#5b5bd6', ?, 60, 60, 8, 1, ?, ?, 'COP')`,
  ).run(id, `sesion-${randomUUID().slice(0, 8)}`, new Date().toISOString(), ownerUserId);
  return id;
}

/** Título oficial CIE-11 si el código existe en el dataset; si no, el de respaldo. */
function cie11Title(db: DatabaseSync, code: string, fallback: string): string {
  const row = db.prepare('SELECT title FROM cie11_entries WHERE code = ?').get(code) as
    | { title: string }
    | undefined;
  return row?.title ?? fallback;
}

function seedPatientsFor(
  db: DatabaseSync,
  ownerUserId: string,
  options: { charges: boolean; currency: string },
): void {
  const agendaId = ensureAgendaFor(db, ownerUserId);
  const price = options.charges ? SESSION_PRICE_COP : 0;

  for (const patient of DEMO_PATIENTS) {
    const patientId = randomUUID();
    db.prepare(
      `INSERT INTO patients
        (id, full_name, email, phone, phone_country_code, birth_date, gender, consultation_reason,
         therapy_start_date, tags_json, notes, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, '+57', ?, ?, ?, ?, ?, '', ?, ?)`,
    ).run(
      patientId,
      patient.fullName,
      `${patient.fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@correo-demo.test`,
      `30${Math.abs(hashString(patient.fullName)) % 100000000}`.slice(0, 10),
      birthDateFor(patient.age),
      patient.gender,
      patient.reason,
      atDay(-25, 9).toISOString().slice(0, 10),
      JSON.stringify(patient.tags),
      new Date().toISOString(),
      ownerUserId,
    );

    if (patient.diagnosis) {
      db.prepare(
        `INSERT INTO diagnoses (id, patient_id, cie11_code, cie11_title, notes, status, diagnosed_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, 'activo', ?, ?)`,
      ).run(
        randomUUID(),
        patientId,
        patient.diagnosis.code,
        cie11Title(db, patient.diagnosis.code, patient.diagnosis.title),
        patient.diagnosis.notes,
        atDay(-20, 9).toISOString(),
        ownerUserId,
      );
    }

    for (const session of patient.sessions) {
      const start = atDay(session.offsetDays, session.hour);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const paid = options.charges && session.paid;
      const fee = options.charges && session.feeNoShow ? NO_SHOW_FEE_COP : 0;
      db.prepare(
        `INSERT INTO bookings
          (id, agenda_id, patient_id, start_at, end_at, price, modality, meet_url, status,
           payment_status, payment_method, paid_at, booked_by, created_at, owner_user_id, currency,
           fee_charged, fee_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'profesional', ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        agendaId,
        patientId,
        start.toISOString(),
        end.toISOString(),
        price,
        session.modality,
        session.modality === 'virtual' ? `https://meet.escuchainterna.local/${randomUUID().slice(0, 8)}` : null,
        session.status,
        paid ? 'pagada' : 'pendiente',
        paid ? 'transferencia' : null,
        paid ? start.toISOString() : null,
        new Date().toISOString(),
        ownerUserId,
        options.currency,
        fee,
        session.feeNoShow ? 'inasistencia' : '',
      );
    }

    for (const note of patient.notes) {
      const when = atDay(note.offsetDays, 18).toISOString();
      db.prepare(
        `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), patientId, note.title, note.content, when, when, ownerUserId);
    }
  }
}

/** Hash estable para derivar teléfonos demo reproducibles. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function seedDemoData(db: DatabaseSync): void {
  seedThinPatients(db);
  seedRichAndresCases(db);
  seedDemoAiConsents(db);
}

/**
 * Para que el ASISTENTE de IA funcione en la demo: todos los pacientes demo "firmaron" el
 * consentimiento informado con la cláusula de finalidad-IA (ai_authorized=1). En PRODUCCIÓN el
 * AiConsentGate es fail-closed; aquí se concede a propósito para poder mostrar la IA clínica.
 * Idempotente: salta los pacientes que ya tienen consentimiento. template_body/signed_name van
 * cifrados como en el repo real.
 */
function seedDemoAiConsents(db: DatabaseSync): void {
  const patients = db
    .prepare('SELECT id, full_name, owner_user_id FROM patients')
    .all() as Array<{ id: string; full_name: string; owner_user_id: string }>;
  const now = new Date().toISOString();
  for (const p of patients) {
    const existing = db
      .prepare('SELECT 1 FROM patient_consents WHERE patient_id = ? AND owner_user_id = ?')
      .get(p.id, p.owner_user_id);
    if (existing) continue;
    db.prepare(
      `INSERT INTO patient_consents
         (id, patient_id, owner_user_id, token, template_title, template_body, status,
          sent_at, signed_at, signed_name, signature_kind, file_path, created_at, revoked_at, ai_authorized)
       VALUES (?, ?, ?, ?, ?, ?, 'firmado', ?, ?, ?, 'digital', NULL, ?, NULL, 1)`,
    ).run(
      randomUUID(),
      p.id,
      p.owner_user_id,
      randomUUID(),
      DEFAULT_CONSENT_TITLE,
      encryptField(DEFAULT_CONSENT_BODY),
      now,
      now,
      encryptField(p.full_name),
      now,
    );
  }
}

/** Pacientes de relleno (los 5 por dueño) que ejercitan los estados de la app. Idempotente. */
function seedThinPatients(db: DatabaseSync): void {
  // BEGIN IMMEDIATE + chequeo del marcador DENTRO de la transacción: cierra el TOCTOU
  // multi-proceso (Next dev cold-starta getDb en varios hilos a la vez; con el chequeo
  // fuera de la transacción ambos leían "ausente" y sembraban → duplicados).
  db.exec('BEGIN IMMEDIATE');
  try {
    const marker = db
      .prepare(`SELECT value_json FROM platform_settings WHERE key = ?`)
      .get(DEMO_MARKER) as { value_json: string } | undefined;
    if (marker && marker.value_json.includes(DEMO_VERSION)) {
      db.exec('COMMIT');
      return;
    }
    for (const account of DEMO_ACCOUNTS) {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(account.email) as
        | { id: string }
        | undefined;
      if (!user) continue;
      seedPatientsFor(db, user.id, { charges: account.charges, currency: 'COP' });
    }
    db.prepare(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(DEMO_MARKER, JSON.stringify({ version: DEMO_VERSION, seededAt: new Date().toISOString() }));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Caso clínico RICO de Andrés Mejía (ficticio): historia consolidada con
 * respuestas, arco de ~6 sesiones, diagnósticos, cuestionarios con tendencia, un
 * caso de pareja (con su esposa) y uno de familia (con su hijo) + genograma.
 *
 * Enriquece al Andrés que YA existe en cada cuenta (no crea otro). Cifra su propio
 * contenido clínico con encryptField, porque el pase de arranque
 * (encryptExistingClinicalData) tiene marcador propio y NO re-cifra datos nuevos en
 * una BD ya inicializada. Aditivo e idempotente (marcador DEMO_RICH_MARKER).
 */
function seedRichAndresCases(db: DatabaseSync): void {
  // Mismo blindaje anti-TOCTOU que seedThinPatients (ver allí). enrichAndresCase además
  // lleva su propio guard de existencia (cinturón y tirantes).
  db.exec('BEGIN IMMEDIATE');
  try {
    const marker = db
      .prepare(`SELECT value_json FROM platform_settings WHERE key = ?`)
      .get(DEMO_RICH_MARKER) as { value_json: string } | undefined;
    if (marker && marker.value_json.includes(DEMO_RICH_VERSION)) {
      db.exec('COMMIT');
      return;
    }
    for (const account of DEMO_ACCOUNTS) {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(account.email) as
        | { id: string }
        | undefined;
      if (!user) continue;
      const andres = db
        .prepare(
          `SELECT id FROM patients WHERE owner_user_id = ? AND full_name = 'Andrés Mejía'
            ORDER BY created_at ASC LIMIT 1`,
        )
        .get(user.id) as { id: string } | undefined;
      if (!andres) continue;
      enrichAndresCase(db, user.id, andres.id, account.charges);
    }
    db.prepare(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(
      DEMO_RICH_MARKER,
      JSON.stringify({ version: DEMO_RICH_VERSION, seededAt: new Date().toISOString() }),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

interface RelativeFields {
  email: string;
  phone: string;
  age: number;
  gender: string;
  reason: string;
  tags: string[];
}

/** Crea (si no existe) un familiar como paciente del mismo dueño. Idempotente por nombre. */
function ensureRelativePatient(
  db: DatabaseSync,
  ownerUserId: string,
  fullName: string,
  f: RelativeFields,
): string {
  const existing = db
    .prepare(`SELECT id FROM patients WHERE owner_user_id = ? AND full_name = ?`)
    .get(ownerUserId, fullName) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO patients
       (id, full_name, email, phone, phone_country_code, birth_date, gender, consultation_reason,
        therapy_start_date, tags_json, notes, created_at, owner_user_id, process_status)
     VALUES (?, ?, ?, ?, '+57', ?, ?, ?, ?, ?, '', ?, ?, 'activo')`,
  ).run(
    id,
    fullName,
    f.email,
    f.phone,
    birthDateFor(f.age),
    f.gender,
    f.reason,
    atDay(-30, 9).toISOString().slice(0, 10),
    JSON.stringify(f.tags),
    new Date().toISOString(),
    ownerUserId,
  );
  return id;
}

interface CaseMemberSpec {
  key: string;
  patientId: string;
  label: string;
  role: string;
  identified: boolean;
}

interface CaseNoteSpec {
  title: string;
  content: string;
  memberId?: string | null;
  patientId?: string | null;
  visibility?: string;
  attendees?: string[];
  atIso: string;
}

interface RelationalCaseSpec {
  kind: 'pareja' | 'familia';
  title: string;
  secretsPolicy: string;
  createdAtIso: string;
  updatedAtIso: string;
  members: CaseMemberSpec[];
  buildProfile: (memberIds: Record<string, string>) => object;
  notes: (memberIds: Record<string, string>) => CaseNoteSpec[];
}

/** Crea un caso relacional (pareja/familia) con miembros, perfil cifrado y notas conjuntas/individuales. */
function createRelationalCase(db: DatabaseSync, ownerUserId: string, spec: RelationalCaseSpec): void {
  const caseId = randomUUID();
  db.prepare(
    `INSERT INTO relational_cases
       (id, owner_user_id, kind, title, status, secrets_policy, secrets_policy_set_at,
        contraindication_reason, profile_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'activo', ?, ?, '', '', ?, ?)`,
  ).run(
    caseId,
    ownerUserId,
    spec.kind,
    spec.title,
    spec.secretsPolicy,
    spec.createdAtIso,
    spec.createdAtIso,
    spec.updatedAtIso,
  );

  const memberIds: Record<string, string> = {};
  const insertMember = db.prepare(
    `INSERT INTO case_members
       (id, case_id, patient_id, owner_user_id, label, consent_status, screening_status,
        screening_at, created_at, role, is_identified_patient)
     VALUES (?, ?, ?, ?, ?, 'otorgado', 'sin_hallazgos', ?, ?, ?, ?)`,
  );
  for (const m of spec.members) {
    const memberId = randomUUID();
    insertMember.run(
      memberId,
      caseId,
      m.patientId,
      ownerUserId,
      m.label,
      spec.createdAtIso,
      spec.createdAtIso,
      m.role,
      m.identified ? 1 : 0,
    );
    memberIds[m.key] = memberId;
  }

  // El perfil incluye relaciones entre miembros → se actualiza tras crearlos (ids reales). Cifrado.
  db.prepare(`UPDATE relational_cases SET profile_json = ? WHERE id = ? AND owner_user_id = ?`).run(
    encryptField(JSON.stringify(spec.buildProfile(memberIds))),
    caseId,
    ownerUserId,
  );

  const insertCaseNote = db.prepare(
    `INSERT INTO case_session_notes
       (id, case_id, owner_user_id, member_id, patient_id, title, content, visibility,
        created_at, updated_at, attendees_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const n of spec.notes(memberIds)) {
    insertCaseNote.run(
      randomUUID(),
      caseId,
      ownerUserId,
      n.memberId ?? null,
      n.patientId ?? null,
      n.title,
      encryptField(n.content),
      n.visibility ?? 'compartido',
      n.atIso,
      n.atIso,
      JSON.stringify(n.attendees ?? []),
    );
  }
}

/** Layer rico sobre un Andrés ya existente: ficha, historia, sesiones, dx, escalas, vínculos y genograma. */
function enrichAndresCase(
  db: DatabaseSync,
  ownerUserId: string,
  andresId: string,
  charges: boolean,
): void {
  // Guard de idempotencia: si este Andrés ya tiene su caso de pareja, ya fue enriquecido.
  const already = db
    .prepare(
      `SELECT 1 AS x FROM relational_cases
        WHERE owner_user_id = ? AND title = 'Andrés y María Fernanda · pareja' LIMIT 1`,
    )
    .get(ownerUserId) as { x: number } | undefined;
  if (already) return;

  const agendaId = ensureAgendaFor(db, ownerUserId);
  const price = charges ? SESSION_PRICE_COP : 0;
  const nowIso = new Date().toISOString();
  const enc = (value: string) => encryptField(value);

  // 1) Ficha más completa de Andrés. La PII solo-display se cifra at-rest (v5) igual que en el
  //    repo real, y el documento lleva su índice ciego (document_hash) para que la deduplicación
  //    funcione sin depender del pase de backfill (que solo corre en BD nuevas).
  const andresDocumento = '94512330';
  db.prepare(
    `UPDATE patients SET
       therapy_start_date = ?, document_type = 'CC', document_number = ?, document_hash = ?,
       phone = '3026619029', phone_country_code = '+57',
       emergency_contact_name = ?,
       emergency_contact_phone = ?, emergency_phone_country_code = '+57',
       current_medication = ?,
       medical_history = ?,
       session_frequency = 'Semanal', session_modality = 'presencial', process_status = 'activo',
       insurance_name = ?, insurance_policy_number = ?,
       referral_source = ?,
       tags_json = ?
     WHERE id = ? AND owner_user_id = ?`,
  ).run(
    atDay(-84, 9).toISOString().slice(0, 10),
    enc(andresDocumento),
    documentBlindIndex(andresDocumento),
    enc('María Fernanda Lozano (esposa)'),
    enc('3041122334'),
    enc('Ninguna por ahora; valoración con medicina general por el insomnio.'),
    enc('Gastritis por estrés (2024), en seguimiento. Sin antecedentes psiquiátricos previos.'),
    enc('Seguros Bolívar'),
    enc('POL-2026-44518'),
    enc('Programa de bienestar laboral de su empresa'),
    JSON.stringify(['Aseguradora', 'Estrés laboral', 'Terapia de pareja']),
    andresId,
    ownerUserId,
  );

  // 2) Diagnósticos (hipótesis: cualquiera las registra; la confirmación FORMAL exige
  // tarjeta profesional, que no se simula en la semilla).
  const insertDiagnosis = db.prepare(
    `INSERT INTO diagnoses
       (id, patient_id, cie11_code, cie11_title, notes, status, diagnosed_at, owner_user_id, kind, diagnosed_by_user_id)
     VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, 'hipotesis', ?)`,
  );
  insertDiagnosis.run(
    randomUUID(),
    andresId,
    '6B43',
    cie11Title(db, '6B43', 'Trastorno de adaptación'),
    'Cuadro reactivo a una sobrecarga laboral sostenida; síntomas ansioso-depresivos de intensidad subclínica a leve.',
    atDay(-80, 9).toISOString(),
    ownerUserId,
    ownerUserId,
  );
  insertDiagnosis.run(
    randomUUID(),
    andresId,
    'QD85',
    'Desgaste ocupacional (burnout)',
    'Eje contextual: agotamiento emocional, distancia mental del trabajo y sensación de baja eficacia.',
    atDay(-80, 9).toISOString(),
    ownerUserId,
    ownerUserId,
  );

  // 3) Historia clínica primaria consolidada (enfoque cognitivo-conductual), con respuestas.
  const histSections = [
    {
      id: 'identificacion',
      title: 'Ficha de identificación',
      fields: [
        { id: 'ocupacion', label: 'Ocupación', type: 'texto_corto' },
        { id: 'escolaridad', label: 'Escolaridad', type: 'seleccion' },
        { id: 'estado-civil', label: 'Estado civil', type: 'seleccion' },
        { id: 'vive-con', label: '¿Con quién vive actualmente?', type: 'texto_corto' },
        { id: 'referido-por', label: 'Referido/a por', type: 'texto_corto' },
      ],
    },
    {
      id: 'motivo',
      title: 'Motivo de consulta',
      fields: [
        { id: 'motivo-paciente', label: 'Motivo (en palabras del paciente)', type: 'texto_largo' },
        { id: 'intensidad', label: 'Intensidad del malestar (1-10)', type: 'escala' },
        { id: 'tratamientos-previos', label: 'Tratamientos previos', type: 'texto_largo' },
      ],
    },
    {
      id: 'historia-problema',
      title: 'Historia del problema actual',
      fields: [
        { id: 'inicio', label: 'Inicio (cuándo y cómo)', type: 'texto_largo' },
        { id: 'evolucion', label: 'Evolución', type: 'texto_largo' },
        { id: 'factores', label: 'Factores desencadenantes y mantenedores', type: 'texto_largo' },
        { id: 'areas-afectadas', label: 'Áreas de vida afectadas', type: 'casillas' },
        { id: 'impacto', label: 'Impacto en el funcionamiento diario', type: 'texto_largo' },
      ],
    },
    {
      id: 'antecedentes',
      title: 'Antecedentes',
      fields: [
        { id: 'medicos', label: 'Antecedentes médicos relevantes', type: 'texto_largo' },
        { id: 'familiares', label: 'Antecedentes familiares de salud mental', type: 'texto_largo' },
        { id: 'sustancias', label: 'Consumo de sustancias', type: 'casillas' },
      ],
    },
    {
      id: 'dinamica-familiar',
      title: 'Dinámica familiar y red de apoyo',
      fields: [
        { id: 'composicion', label: 'Composición del hogar', type: 'texto_corto' },
        { id: 'dinamica', label: 'Dinámica familiar actual', type: 'texto_largo' },
        { id: 'red-apoyo', label: 'Red de apoyo percibida', type: 'seleccion' },
      ],
    },
    {
      id: 'examen-mental',
      title: 'Examen mental y observaciones',
      fields: [
        { id: 'apariencia', label: 'Apariencia y actitud', type: 'texto_largo' },
        { id: 'afecto', label: 'Estado de ánimo y afecto', type: 'texto_largo' },
        { id: 'riesgo', label: 'Indicadores de riesgo', type: 'texto_largo' },
      ],
    },
    {
      id: 'plan',
      title: 'Impresión diagnóstica y plan',
      fields: [
        { id: 'impresion', label: 'Impresión diagnóstica inicial', type: 'texto_largo' },
        { id: 'objetivos', label: 'Objetivos terapéuticos iniciales', type: 'texto_largo' },
        { id: 'frecuencia', label: 'Frecuencia de sesiones acordada', type: 'seleccion' },
      ],
    },
  ];
  const histAnswers: Record<string, string | string[]> = {
    ocupacion: 'Gerente de operaciones logísticas',
    escolaridad: 'Licenciatura',
    'estado-civil': 'Casado/a',
    'vive-con': 'Su esposa (María Fernanda) y su hijo adolescente (Tomás, 14)',
    'referido-por': 'Programa de bienestar laboral de su empresa',
    'motivo-paciente':
      '«Llevo meses funcionando en automático: irritable, agotado y durmiendo mal. Siento que ya no rindo y en casa todo se tensiona.»',
    intensidad: '8',
    'tratamientos-previos':
      'Sin terapia psicológica previa. Hace dos años recibió manejo médico por gastritis asociada al estrés.',
    inicio:
      'Los síntomas se intensifican hace ~8 meses, tras asumir una doble jefatura por una reestructuración en la empresa.',
    evolucion:
      'Curso progresivo: del cansancio y la sobrecarga iniciales al agotamiento emocional, el cinismo hacia el trabajo y el insomnio de mantenimiento.',
    factores:
      'Desencadenan: jornadas de 11-12 h, correos fuera de horario y metas poco realistas. Mantienen: dificultad para delegar y para poner límites; autoexigencia elevada.',
    'areas-afectadas': ['Laboral / académica', 'Pareja', 'Sueño', 'Salud física'],
    impacto:
      'Bajón del rendimiento y errores por descuido, distanciamiento de la pareja y abandono del ejercicio que antes hacía.',
    medicos: 'Gastritis por estrés (2024), en seguimiento. Sin otras patologías de base.',
    familiares: 'Padre con rasgos ansiosos y muy volcado al trabajo; madre con un episodio depresivo en la adultez.',
    sustancias: ['Alcohol', 'Tabaco'],
    composicion: 'Vive con su esposa y su hijo de 14 años.',
    dinamica:
      'Históricamente cercana; en el último año la comunicación se ha tensado por su ausencia emocional y por discusiones en torno a la crianza de Tomás.',
    'red-apoyo': 'Moderada',
    apariencia: 'Pulcro y colaborador, con postura tensa; habla rápido y le cuesta sostener pausas.',
    afecto: 'Ánimo irritable-decaído y afecto algo restringido; se moviliza al hablar de su hijo.',
    riesgo:
      'Sin ideación suicida ni autolesiva. Sin riesgo a terceros. Se acuerda monitorear el ánimo y el sueño.',
    impresion:
      'Cuadro compatible con trastorno de adaptación con síntomas mixtos, en contexto de desgaste ocupacional (burnout). Ver la pestaña Diagnóstico.',
    objetivos:
      '1) Recuperar la higiene del sueño. 2) Establecer límites laborales sostenibles. 3) Reactivar el autocuidado y la vida de pareja. 4) Reestructurar las creencias de autoexigencia.',
    frecuencia: 'Semanal',
  };
  db.prepare(
    `INSERT INTO clinical_records
       (id, patient_id, template_id, title, answers_json, sections_json, kind, created_at, updated_at, owner_user_id)
     VALUES (?, ?, NULL, ?, ?, ?, 'historia', ?, ?, ?)`,
  ).run(
    randomUUID(),
    andresId,
    'Historia clínica · Cognitivo-conductual',
    enc(JSON.stringify(histAnswers)),
    JSON.stringify(histSections),
    atDay(-84, 9).toISOString(),
    atDay(-14, 9).toISOString(),
    ownerUserId,
  );

  // 4) Arco de ~6 sesiones. La nota thin previa («Primera sesión») se reetiqueta como
  // seguimiento para no duplicar el encuadre (su contenido ya está cifrado at-rest).
  db.prepare(
    `UPDATE session_notes SET title = 'Seguimiento · ajuste de límites'
       WHERE patient_id = ? AND owner_user_id = ? AND title = 'Primera sesión'`,
  ).run(andresId, ownerUserId);

  const sessions: Array<{
    off: number;
    status: string;
    paid: boolean;
    title: string;
    content: string;
    kind?: string;
  }> = [
    {
      off: -84,
      status: 'completada',
      paid: true,
      kind: 'primera',
      title: 'Encuadre y evaluación inicial',
      content:
        'Primera entrevista. Se acuerda el encuadre (semanal, presencial) y se recoge el motivo de consulta: agotamiento sostenido, irritabilidad e insomnio asociados a una sobrecarga laboral de ~8 meses. Se aplican GAD-7 y PHQ-9 como línea base. Tarea: autorregistro de horarios de trabajo y de sueño.',
    },
    {
      off: -70,
      status: 'completada',
      paid: true,
      title: 'Análisis funcional del estrés',
      content:
        'Se revisa el autorregistro: jornadas de 11-12 h y respuesta a correos por la noche. Análisis A-B-C de la sobrecarga: antecedentes (metas poco realistas), conducta (sobre-responsabilizarse, no delegar) y consecuencia (alivio momentáneo y agotamiento acumulado). Psicoeducación sobre el ciclo del estrés.',
    },
    {
      off: -56,
      status: 'completada',
      paid: true,
      title: 'Higiene del sueño y desactivación',
      content:
        'Insomnio de mantenimiento. Se introducen pautas de higiene del sueño y respiración diafragmática con relajación muscular progresiva. Acuerda apagar el correo a las 8 p.m. tres días por semana. Reporta dos noches con mejor descanso.',
    },
    {
      off: -42,
      status: 'completada',
      paid: true,
      title: 'Límites laborales y delegación',
      content:
        'Trabajo en asertividad: ensayo conductual para delegar dos responsabilidades y negociar plazos con su jefatura. Se identifica la creencia «si no lo hago yo, sale mal». Tarea: delegar una tarea concreta antes de la próxima sesión.',
    },
    {
      off: -28,
      status: 'completada',
      paid: true,
      title: 'Reestructuración cognitiva',
      content:
        'Se identifican distorsiones (deberías, catastrofización) y se reestructura la autoexigencia con registro de pensamientos. Logró delegar y negociar un plazo; bajó la activación. GAD-7 de control con descenso respecto a la línea base.',
    },
    {
      off: -14,
      status: 'completada',
      paid: true,
      title: 'Pareja y autocuidado · revisión',
      content:
        'Reaparece el tema de pareja: distancia y discusiones por la crianza. Se acuerda abrir un espacio conjunto con su esposa (ver el caso de pareja) y, más adelante, una sesión familiar con Tomás. Retoma el ejercicio dos veces por semana.',
    },
    { off: 7, status: 'agendada', paid: false, title: '', content: '' },
  ];
  const insertBooking = db.prepare(
    `INSERT INTO bookings
       (id, agenda_id, patient_id, start_at, end_at, price, modality, meet_url, status,
        payment_status, payment_method, paid_at, booked_by, created_at, owner_user_id, currency,
        fee_charged, fee_reason)
     VALUES (?, ?, ?, ?, ?, ?, 'presencial', NULL, ?, ?, ?, ?, 'profesional', ?, ?, 'COP', 0, '')`,
  );
  const insertNote = db.prepare(
    `INSERT INTO session_notes
       (id, patient_id, title, content, session_kind, created_at, updated_at, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of sessions) {
    const start = atDay(s.off, 9);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const paid = charges && s.paid;
    insertBooking.run(
      randomUUID(),
      agendaId,
      andresId,
      start.toISOString(),
      end.toISOString(),
      price,
      s.status,
      paid ? 'pagada' : 'pendiente',
      paid ? 'transferencia' : null,
      paid ? start.toISOString() : null,
      nowIso,
      ownerUserId,
    );
    if (s.content) {
      insertNote.run(
        randomUUID(),
        andresId,
        s.title,
        enc(s.content),
        s.kind ?? 'seguimiento',
        start.toISOString(),
        start.toISOString(),
        ownerUserId,
      );
    }
  }

  // 5) Cuestionarios con tendencia (GAD-7 línea base + control; PHQ-9 línea base).
  const insertAssessment = db.prepare(
    `INSERT INTO patient_assessments
       (id, owner_user_id, patient_id, instrument_id, answers_json, total_score, severity, risk_flag, notes, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertAssessment.run(
    randomUUID(), ownerUserId, andresId, 'gad-7', JSON.stringify([3, 3, 2, 3, 2, 2, 1]), 16, 'Grave', 0,
    enc('Aplicado en la primera sesión como línea base.'), atDay(-84, 9).toISOString(),
  );
  insertAssessment.run(
    randomUUID(), ownerUserId, andresId, 'gad-7', JSON.stringify([2, 1, 1, 2, 1, 1, 1]), 9, 'Leve', 0,
    enc('Control tras la reestructuración y los límites: descenso claro de la ansiedad.'), atDay(-28, 9).toISOString(),
  );
  insertAssessment.run(
    randomUUID(), ownerUserId, andresId, 'phq-9', JSON.stringify([2, 2, 2, 1, 1, 1, 1, 1, 0]), 11, 'Moderada', 0,
    enc('Sin ideación de daño (ítem 9 = 0). Predominan la fatiga y la anhedonia leve.'), atDay(-84, 9).toISOString(),
  );

  // 6) Cónyuge e hijo como pacientes (requisito de los casos relacionales).
  const mariaId = ensureRelativePatient(db, ownerUserId, 'María Fernanda Lozano', {
    email: 'maria.f.lozano@correo-demo.test',
    phone: '3041122334',
    age: 39,
    gender: 'femenino',
    reason: 'Terapia de pareja: desgaste y distancia por la sobrecarga laboral de su esposo.',
    tags: ['Terapia de pareja'],
  });
  const tomasId = ensureRelativePatient(db, ownerUserId, 'Tomás Mejía Lozano', {
    email: 'tomas.mejia.l@correo-demo.test',
    phone: '3041122777',
    age: 14,
    gender: 'masculino',
    reason: 'Terapia familiar: irritabilidad y bajón académico recientes.',
    tags: ['Familia', 'Adolescente'],
  });

  // 7) Caso de PAREJA.
  createRelationalCase(db, ownerUserId, {
    kind: 'pareja',
    title: 'Andrés y María Fernanda · pareja',
    secretsPolicy: 'no_secretos',
    createdAtIso: atDay(-21, 10).toISOString(),
    updatedAtIso: atDay(-5, 10).toISOString(),
    members: [
      { key: 'andres', patientId: andresId, label: 'Andrés', role: 'Esposo', identified: false },
      { key: 'maria', patientId: mariaId, label: 'María Fernanda', role: 'Esposa', identified: false },
    ],
    buildProfile: (m) => ({
      systemEval: {
        lifeCycleStage: 'Familia con hijo adolescente',
        structure:
          'Subsistema conyugal debilitado por la sobrecarga laboral de Andrés; límites difusos entre el trabajo y el hogar. La pareja se ha vuelto más "logística" que afectiva.',
        communication:
          'Patrón demanda–retirada: María busca cercanía y Andrés se repliega hacia el trabajo. Escaladas breves seguidas de distanciamiento.',
        systemMotive: 'Recuperar la conexión de pareja y repartir la carga emocional y de la crianza.',
      },
      objectives:
        'Restablecer rituales de pareja; acordar reglas sobre el trabajo en casa; coordinar la coparentalidad con Tomás.',
      events: [
        { id: randomUUID(), date: '2008', title: 'Se conocen', note: 'En el ámbito laboral.' },
        { id: randomUUID(), date: '2010', title: 'Matrimonio', note: 'Conviven desde entonces.' },
        { id: randomUUID(), date: '2012', title: 'Nace Tomás', note: 'Hijo único.' },
        {
          id: randomUUID(),
          date: '2025',
          title: 'Reestructuración laboral de Andrés',
          note: 'Asume una doble jefatura; comienza la sobrecarga.',
        },
      ],
      relations: [
        {
          id: randomUUID(),
          aMemberId: m.andres,
          bMemberId: m.maria,
          quality: 'ambivalente',
          note: 'Vínculo históricamente sólido, hoy tensionado por la distancia.',
        },
      ],
    }),
    notes: (m) => [
      {
        title: 'Sesión conjunta 1 · encuadre de pareja',
        content:
          'Asisten ambos. Se acuerda la política de no-secretos y el encuadre del trabajo de pareja. Cada uno expone su versión del distanciamiento. Se observa el ciclo demanda–retirada. Tarea: reservar 20 min diarios sin pantallas.',
        attendees: [m.andres, m.maria],
        atIso: atDay(-19, 17).toISOString(),
      },
      {
        title: 'Sesión conjunta 2 · ciclo demanda–retirada',
        content:
          'Se mapea una discusión típica: María reclama presencia, Andrés se justifica con el trabajo y se retira. Se entrena una conversación con escucha por turnos. Reportan una semana algo más calmada.',
        attendees: [m.andres, m.maria],
        atIso: atDay(-5, 17).toISOString(),
      },
    ],
  });

  // 8) Caso de FAMILIA (Tomás como paciente identificado del sistema).
  createRelationalCase(db, ownerUserId, {
    kind: 'familia',
    title: 'Familia Mejía Lozano',
    secretsPolicy: 'no_secretos',
    createdAtIso: atDay(-14, 16).toISOString(),
    updatedAtIso: atDay(-3, 16).toISOString(),
    members: [
      { key: 'andres', patientId: andresId, label: 'Andrés (padre)', role: 'Padre', identified: false },
      { key: 'maria', patientId: mariaId, label: 'María Fernanda (madre)', role: 'Madre', identified: false },
      { key: 'tomas', patientId: tomasId, label: 'Tomás (hijo)', role: 'Hijo', identified: true },
    ],
    buildProfile: (m) => ({
      systemEval: {
        lifeCycleStage: 'Familia con hijo adolescente',
        structure:
          'Jerarquía parental debilitada por la ausencia de Andrés; coalición madre–hijo. Tomás ocupa por momentos un rol parentalizado con la madre.',
        communication:
          'Comunicación triangulada: los desacuerdos de la pareja se filtran a la relación con Tomás. Poco espacio para una conversación directa padre–hijo.',
        systemMotive:
          'Reordenar la jerarquía y abrir un canal directo entre Andrés y Tomás; bajar la conflictividad en casa.',
      },
      objectives:
        'Recuperar la autoridad parental compartida; tiempo padre–hijo; reglas claras de convivencia y de pantallas.',
      events: [
        {
          id: randomUUID(),
          date: '2025',
          title: 'Sobrecarga laboral del padre',
          note: 'Aumentan las ausencias y la tensión en casa.',
        },
        {
          id: randomUUID(),
          date: '2026-02',
          title: 'Bajón académico de Tomás',
          note: 'Reportes del colegio; irritabilidad creciente.',
        },
      ],
      relations: [
        {
          id: randomUUID(),
          aMemberId: m.andres,
          bMemberId: m.maria,
          quality: 'ambivalente',
          note: 'Tensión conyugal de fondo.',
        },
        {
          id: randomUUID(),
          aMemberId: m.maria,
          bMemberId: m.tomas,
          quality: 'fusionado',
          note: 'Cercanía intensa, con dificultad para poner límites.',
        },
        {
          id: randomUUID(),
          aMemberId: m.andres,
          bMemberId: m.tomas,
          quality: 'distante',
          note: 'Poco contacto; Tomás resiente la ausencia del padre.',
        },
      ],
    }),
    notes: (m) => [
      {
        title: 'Sesión familiar 1 · mapa del problema',
        content:
          'Asisten los tres. Se externaliza «la tensión» como algo que entró con la sobrecarga laboral. Se observa la coalición madre–hijo y la distancia padre–hijo. Se acuerda una actividad semanal padre–hijo.',
        attendees: [m.andres, m.maria, m.tomas],
        atIso: atDay(-12, 16).toISOString(),
      },
      {
        title: 'Subsistema parental · acuerdos de crianza',
        content:
          'Sesión con la pareja parental (sin Tomás). Acuerdan reglas comunes de pantallas y horarios y sostener juntos los límites para no dejar sola a la madre.',
        attendees: [m.andres, m.maria],
        atIso: atDay(-6, 16).toISOString(),
      },
      {
        title: 'Espacio individual con Tomás',
        content:
          'Sesión individual con el adolescente. Expresa que extraña a su papá y que se siente «en medio» de las discusiones. Se valida y se trabaja en comunicación. Nota de visibilidad individual.',
        memberId: m.tomas,
        patientId: tomasId,
        visibility: 'individual',
        attendees: [m.tomas],
        atIso: atDay(-3, 16).toISOString(),
      },
    ],
  });

  // 9) Genograma (3 generaciones) sobre el expediente de Andrés.
  const g = {
    andres: randomUUID(),
    maria: randomUUID(),
    tomas: randomUUID(),
    jorge: randomUUID(),
    carmen: randomUUID(),
    gloria: randomUUID(),
  };
  const member = (
    id: string,
    name: string,
    relation: string,
    gender: string,
    age: number | null,
    x: number,
    y: number,
    extra: Partial<{
      identifiedPatient: boolean;
      conditions: string[];
      role: string;
      household: boolean;
      notes: string;
      deceased: boolean;
      deceasedYear: number | null;
    }> = {},
  ) => ({
    id,
    name,
    relation,
    gender,
    age,
    x,
    y,
    deceased: extra.deceased ?? false,
    deceasedYear: extra.deceasedYear ?? null,
    identifiedPatient: extra.identifiedPatient ?? false,
    conditions: extra.conditions ?? [],
    role: extra.role ?? '',
    household: extra.household ?? false,
    notes: extra.notes ?? '',
  });
  const link = (fromId: string, toId: string, kind: string, notes = '') => ({
    id: randomUUID(),
    fromId,
    toId,
    kind,
    violenceType: '',
    notes,
  });
  const genogram = {
    members: [
      member(g.jorge, 'Jorge Mejía', 'Padre de Andrés', 'masculino', 70, 300, 120, {
        notes: 'Muy volcado al trabajo; rasgos ansiosos.',
      }),
      member(g.carmen, 'Carmen Restrepo', 'Madre de Andrés', 'femenino', 67, 460, 120, {
        conditions: ['salud_mental'],
        notes: 'Episodio depresivo en la adultez.',
      }),
      member(g.gloria, 'Gloria Lozano', 'Madre de María', 'femenino', 64, 720, 120, {}),
      member(g.andres, 'Andrés Mejía', 'Paciente', 'masculino', 42, 380, 360, {
        role: 'Proveedor / sobrecargado',
        household: true,
        notes: 'Repite el patrón de sobreinvolucramiento laboral del padre.',
      }),
      member(g.maria, 'María Fernanda Lozano', 'Esposa', 'femenino', 39, 620, 360, {
        household: true,
      }),
      member(g.tomas, 'Tomás Mejía Lozano', 'Hijo', 'masculino', 14, 500, 560, {
        identifiedPatient: true,
        household: true,
        notes: 'Paciente identificado por la familia; bajón académico e irritabilidad.',
      }),
    ],
    links: [
      link(g.jorge, g.carmen, 'matrimonio'),
      link(g.jorge, g.andres, 'hijo'),
      link(g.carmen, g.andres, 'hijo'),
      link(g.gloria, g.maria, 'hijo'),
      link(g.andres, g.maria, 'matrimonio'),
      link(g.andres, g.tomas, 'hijo'),
      link(g.maria, g.tomas, 'hijo'),
      link(g.andres, g.maria, 'distante', 'Distancia afectiva en el último año.'),
      link(g.maria, g.tomas, 'fusion', 'Vínculo muy estrecho.'),
      link(g.andres, g.tomas, 'distante', 'Poco contacto por las ausencias del padre.'),
      link(g.andres, g.jorge, 'distante', 'Relación correcta pero fría.'),
    ],
    patterns: [
      {
        id: randomUUID(),
        kind: 'coalicion',
        memberIds: [g.maria, g.tomas],
        note: 'Coalición madre–hijo ante la ausencia del padre.',
      },
      {
        id: randomUUID(),
        kind: 'triangulacion',
        memberIds: [g.andres, g.maria, g.tomas],
        note: 'Las tensiones de la pareja se desvían hacia Tomás.',
      },
      {
        id: randomUUID(),
        kind: 'repeticion',
        memberIds: [g.jorge, g.andres],
        note: 'Sobreinvolucramiento laboral que se repite del padre al hijo.',
      },
    ],
  };
  db.prepare(
    `INSERT INTO family_maps (id, patient_id, owner_user_id, title, data_json, created_at, updated_at)
     VALUES (?, ?, ?, 'Genograma — Familia Mejía Lozano', ?, ?, ?)`,
  ).run(
    randomUUID(),
    andresId,
    ownerUserId,
    JSON.stringify(genogram),
    atDay(-70, 9).toISOString(),
    atDay(-14, 9).toISOString(),
  );
}
