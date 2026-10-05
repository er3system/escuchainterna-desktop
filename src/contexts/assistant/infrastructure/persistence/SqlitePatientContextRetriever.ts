import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import type {
  PatientContextRetriever,
  RetrievedPatientContext,
  RetrievedPatientSummary,
} from '../../domain/PatientContextRetriever';
import type { AiConsentGate } from '../../domain/AiConsentGate';
import { SqliteAiConsentGate } from './SqliteAiConsentGate';

const NOTE_EXCERPT_LENGTH = 400;
const MAX_NOTES = 5;
const MAX_DIAGNOSES = 10;
const MAX_RECORDS = 10;
const MAX_BOOKINGS = 5;

interface PatientRow {
  id: string;
  full_name: string;
  gender: string;
  birth_date: string | null;
  consultation_reason: string;
  therapy_start_date: string | null;
  tags_json: string;
}

interface DiagnosisRow {
  cie11_code: string;
  cie11_title: string;
  status: string;
  diagnosed_at: string;
}

interface NoteRow {
  title: string;
  content: string;
  created_at: string;
}

interface RecordRow {
  title: string;
  updated_at: string;
}

interface BookingRow {
  start_at: string;
  status: string;
  agenda_name: string;
}

function toExcerpt(content: string): string {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > NOTE_EXCERPT_LENGTH ? `${clean.slice(0, NOTE_EXCERPT_LENGTH - 1)}…` : clean;
}

/**
 * Pacientes en CUSTODIA institucional (§3.3): los que tienen una asignación VIVA sin
 * tratante (retenidos por la institución tras la baja de su tratante). El asistente
 * acompaña el trabajo clínico ACTIVO; un paciente en custodia no tiene tratante activo,
 * así que queda FUERA del alcance de la IA. El custodio (org_master) sí puede leer su
 * expediente desde la ficha, pero ese acceso queda trazado como ruptura de cristal — el
 * asistente no es un canal trazado por paciente, por eso se excluye aquí.
 */
const EXCLUDE_CUSTODY_SQL = `id NOT IN (
  SELECT patient_id FROM patient_assignments
  WHERE status != 'reasignada' AND tratante_user_id IS NULL
)`;

/**
 * Retriever de contexto clínico acotado ESTRUCTURALMENTE al dueño en sesión
 * (guardrail nº 1 del asistente): cada consulta SQL filtra por
 * owner_user_id = dueño con el que se construyó el retriever. No existe
 * ningún camino de código que devuelva pacientes, notas, historias,
 * diagnósticos o citas de otro dueño — la restricción vive en el WHERE,
 * no en el prompt.
 */
export class SqlitePatientContextRetriever implements PatientContextRetriever {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
    // Gate de consentimiento-IA: por defecto la impl Sqlite acotada al MISMO dueño.
    private readonly aiConsentGate: AiConsentGate = new SqliteAiConsentGate(ownerUserId, db),
  ) {}

  public async listPatients(): Promise<RetrievedPatientSummary[]> {
    const rows = await this.db.query<{ id: string; full_name: string }>(
      `SELECT id, full_name FROM patients
         WHERE owner_user_id = ? AND archived = 0
           AND ${EXCLUDE_CUSTODY_SQL}
         ORDER BY LOWER(full_name) ASC`,
      [this.ownerUserId],
    );
    return rows.map((row) => ({ id: row.id, fullName: row.full_name }));
  }

  public async retrieve(patientId: string): Promise<RetrievedPatientContext | null> {
    const patient = await this.db.queryRow<PatientRow>(
      `SELECT id, full_name, gender, birth_date, consultation_reason, therapy_start_date, tags_json
         FROM patients WHERE id = ? AND owner_user_id = ?
           AND ${EXCLUDE_CUSTODY_SQL}`,
      [patientId, this.ownerUserId],
    );
    if (!patient) return null;

    // Consentimiento de IA (Ley 1581): sin autorización de finalidad-IA vigente, el asistente NO
    // recibe el contexto de este paciente. Se comprueba tras confirmar paciente/dueño/custodia y
    // ANTES de descifrar consultation_reason o de tocar notas/historias → cero dato clínico al LLM.
    if (!(await this.aiConsentGate.isAuthorized(patientId))) return null;

    const diagnoses = await this.db.query<DiagnosisRow>(
      `SELECT cie11_code, cie11_title, status, diagnosed_at
         FROM diagnoses WHERE patient_id = ? AND owner_user_id = ?
         ORDER BY diagnosed_at DESC LIMIT ${MAX_DIAGNOSES}`,
      [patientId, this.ownerUserId],
    );

    const notes = await this.db.query<NoteRow>(
      `SELECT title, content, created_at
         FROM session_notes WHERE patient_id = ? AND owner_user_id = ?
         ORDER BY created_at DESC LIMIT ${MAX_NOTES}`,
      [patientId, this.ownerUserId],
    );

    const records = await this.db.query<RecordRow>(
      `SELECT title, updated_at
         FROM clinical_records WHERE patient_id = ? AND owner_user_id = ?
         ORDER BY updated_at DESC LIMIT ${MAX_RECORDS}`,
      [patientId, this.ownerUserId],
    );

    const bookings = await this.db.query<BookingRow>(
      `SELECT b.start_at, b.status, a.name AS agenda_name
         FROM bookings b
         JOIN agendas a ON a.id = b.agenda_id AND a.owner_user_id = b.owner_user_id
         WHERE b.patient_id = ? AND b.owner_user_id = ?
           AND b.start_at >= ? AND b.status IN ('agendada', 'confirmada')
         ORDER BY b.start_at ASC LIMIT ${MAX_BOOKINGS}`,
      [patientId, this.ownerUserId, new Date().toISOString()],
    );

    return {
      patient: {
        id: patient.id,
        fullName: patient.full_name,
        gender: patient.gender,
        birthDate: patient.birth_date,
        // consultation_reason está cifrada at-rest (v5): descifrar antes de exponerla a la IA.
        consultationReason: decryptField(patient.consultation_reason),
        therapyStartDate: patient.therapy_start_date,
        tags: JSON.parse(patient.tags_json) as string[],
      },
      diagnoses: diagnoses.map((row) => ({
        code: row.cie11_code,
        title: row.cie11_title,
        status: row.status,
        diagnosedAt: row.diagnosed_at,
      })),
      recentNotes: notes.map((row) => ({
        title: row.title,
        // Cifrado at-rest (v3 §1.1): el contenido se descifra antes del extracto.
        excerpt: toExcerpt(decryptField(row.content)),
        createdAt: row.created_at,
      })),
      clinicalRecords: records.map((row) => ({ title: row.title, updatedAt: row.updated_at })),
      upcomingBookings: bookings.map((row) => ({
        startAt: row.start_at,
        status: row.status,
        agendaName: row.agenda_name,
      })),
    };
  }
}
