import type { DatabaseAdapter, SqlParam } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import {
  decryptPatientRow,
  documentBlindIndex,
} from '@/shared/infrastructure/persistence/patientPiiEncryption';
import { Patient, PatientPrimitives } from '../../domain/Patient';
import { PatientRepository, PatientSearchCriteria } from '../../domain/repositories/PatientRepository';

interface PatientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  phone_country_code: string;
  birth_date: string | null;
  gender: string;
  consultation_reason: string;
  therapy_start_date: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_phone_country_code: string;
  notes: string;
  tags_json: string;
  document_type: string;
  document_number: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_document: string;
  organization_id: string | null;
  reminders_whatsapp: number;
  reminders_email: number;
  archived: number;
  created_at: string;
}

function rowToPatient(row: PatientRow): Patient {
  // Descifra las columnas PII at-rest (consultation_reason, emergency_*, guardian_*, notes,
  // document_number, …) antes de mapear. Tolerante con datos previos al cifrado.
  decryptPatientRow(row);
  const primitives: PatientPrimitives = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code || '+52',
    birthDate: row.birth_date,
    gender: row.gender,
    consultationReason: row.consultation_reason,
    therapyStartDate: row.therapy_start_date,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyPhoneCountryCode: row.emergency_phone_country_code || '+52',
    notes: row.notes,
    tags: JSON.parse(row.tags_json) as string[],
    documentType: row.document_type ?? '',
    documentNumber: row.document_number ?? '',
    guardianName: row.guardian_name ?? '',
    guardianRelationship: row.guardian_relationship ?? '',
    guardianDocument: row.guardian_document ?? '',
    organizationId: row.organization_id ?? null,
    receivesWhatsappReminders: row.reminders_whatsapp !== 0,
    receivesEmailReminders: row.reminders_email !== 0,
    archived: row.archived === 1,
    createdAt: row.created_at,
  };
  return Patient.fromPrimitives(primitives);
}

/** Repositorio de pacientes acotado al dueño (owner_user_id) de la sesión. */
export class SqlitePatientRepository implements PatientRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(patient: Patient): Promise<void> {
    const p = patient.toPrimitives();
    await this.db.execute(
      `INSERT INTO patients
          (id, full_name, email, phone, phone_country_code, birth_date, gender, consultation_reason,
           therapy_start_date, emergency_contact_name, emergency_contact_phone,
           emergency_phone_country_code, notes, tags_json, document_type, document_number, document_hash,
           guardian_name, guardian_relationship, guardian_document,
           organization_id, reminders_whatsapp, reminders_email, archived, created_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           full_name = excluded.full_name,
           email = excluded.email,
           phone = excluded.phone,
           phone_country_code = excluded.phone_country_code,
           birth_date = excluded.birth_date,
           gender = excluded.gender,
           consultation_reason = excluded.consultation_reason,
           therapy_start_date = excluded.therapy_start_date,
           emergency_contact_name = excluded.emergency_contact_name,
           emergency_contact_phone = excluded.emergency_contact_phone,
           emergency_phone_country_code = excluded.emergency_phone_country_code,
           notes = excluded.notes,
           tags_json = excluded.tags_json,
           document_type = excluded.document_type,
           document_number = excluded.document_number,
           document_hash = excluded.document_hash,
           guardian_name = excluded.guardian_name,
           guardian_relationship = excluded.guardian_relationship,
           guardian_document = excluded.guardian_document,
           reminders_whatsapp = excluded.reminders_whatsapp,
           reminders_email = excluded.reminders_email,
           archived = excluded.archived
         WHERE patients.owner_user_id = excluded.owner_user_id`,
      [
        p.id,
        p.fullName,
        p.email,
        p.phone,
        p.phoneCountryCode ?? '+52',
        p.birthDate,
        p.gender,
        // Columnas PII cifradas at-rest (IV aleatorio). Idempotente y tolera vacío/ya-cifrado.
        encryptField(p.consultationReason),
        p.therapyStartDate,
        encryptField(p.emergencyContactName),
        encryptField(p.emergencyContactPhone),
        p.emergencyPhoneCountryCode ?? '+52',
        encryptField(p.notes),
        JSON.stringify(p.tags),
        p.documentType ?? '',
        encryptField(p.documentNumber ?? ''),
        // Índice ciego del documento para deduplicar sin guardarlo en claro.
        documentBlindIndex(p.documentNumber ?? ''),
        encryptField(p.guardianName ?? ''),
        encryptField(p.guardianRelationship ?? ''),
        encryptField(p.guardianDocument ?? ''),
        p.organizationId ?? null,
        p.receivesWhatsappReminders === false ? 0 : 1,
        p.receivesEmailReminders === false ? 0 : 1,
        p.archived ? 1 : 0,
        p.createdAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<Patient | null> {
    const row = await this.db.queryRow<PatientRow>(
      'SELECT * FROM patients WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? rowToPatient(row) : null;
  }

  public async search(criteria: PatientSearchCriteria): Promise<Patient[]> {
    // Las subconsultas a bookings/diagnoses se acotan SIEMPRE por el mismo
    // owner_user_id (regla de oro v2): el dueño solo cruza con SUS sesiones.
    const conditions: string[] = ['p.owner_user_id = ?'];
    const params: SqlParam[] = [this.ownerUserId];

    // Estado de archivo.
    if (criteria.archived === 'activos') conditions.push('p.archived = 0');
    else if (criteria.archived === 'archivados') conditions.push('p.archived = 1');
    // 'todos' ⇒ sin condición.

    if (criteria.text.length > 0) {
      // Búsqueda libre: nombre, correo, teléfono y etiquetas por SUBCADENA, y documento por
      // IGUALDAD EXACTA vía el índice ciego (document_hash). El documento está cifrado at-rest,
      // así que ya no se puede buscar por subcadena; teclear el documento COMPLETO sí lo encuentra.
      conditions.push(
        '(p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.tags_json LIKE ? OR p.document_hash = ?)',
      );
      const like = `%${criteria.text}%`;
      params.push(like, like, like, like, documentBlindIndex(criteria.text));
    }

    // Etiqueta exacta dentro del array JSON tags_json (cada etiqueta serializada
    // como "valor" entre comillas; coincidencia literal para no confundir subcadenas).
    if (criteria.tag) {
      conditions.push('p.tags_json LIKE ?');
      params.push(`%${JSON.stringify(criteria.tag)}%`);
    }

    if (criteria.gender) {
      conditions.push('p.gender = ?');
      params.push(criteria.gender);
    }

    // Diagnóstico activo (join existencial a diagnoses status='activo').
    const hasActiveDiagnosis = `EXISTS (
      SELECT 1 FROM diagnoses d
      WHERE d.patient_id = p.id AND d.owner_user_id = p.owner_user_id AND d.status = 'activo'
    )`;
    if (criteria.diagnosis === 'con') conditions.push(hasActiveDiagnosis);
    else if (criteria.diagnosis === 'sin') conditions.push(`NOT ${hasActiveDiagnosis}`);

    const now = new Date();

    // Última sesión efectiva: booking no cancelada con start_at en el pasado.
    if (criteria.lastSession !== 'todos') {
      const pastSession = (extra: string) => `EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.patient_id = p.id AND b.owner_user_id = p.owner_user_id
          AND b.status != 'cancelada' AND b.start_at < ?${extra ? ` AND ${extra}` : ''}
      )`;
      const nowIso = now.toISOString();
      if (criteria.lastSession === 'sin') {
        // Sin ninguna sesión pasada registrada.
        conditions.push(`NOT ${pastSession('')}`);
        params.push(nowIso);
      } else if (criteria.lastSession === 'este_mes') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        conditions.push(pastSession('b.start_at >= ?'));
        params.push(nowIso, monthStart);
      } else {
        // "Hace más de N meses": tiene sesiones pasadas pero NINGUNA dentro de los últimos N meses.
        const months = criteria.lastSession === 'mas_6_meses' ? 6 : 3;
        const cutoff = new Date(now);
        cutoff.setMonth(cutoff.getMonth() - months);
        const cutoffIso = cutoff.toISOString();
        conditions.push(pastSession(''));
        params.push(nowIso);
        conditions.push(`NOT ${pastSession('b.start_at >= ?')}`);
        params.push(nowIso, cutoffIso);
      }
    }

    // Próxima cita: booking futura no cancelada.
    if (criteria.nextAppointment !== 'todos') {
      const futureBooking = `EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.patient_id = p.id AND b.owner_user_id = p.owner_user_id
          AND b.status != 'cancelada' AND b.start_at >= ?
      )`;
      if (criteria.nextAppointment === 'con') conditions.push(futureBooking);
      else conditions.push(`NOT ${futureBooking}`);
      params.push(now.toISOString());
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const rows = await this.db.query<PatientRow>(
      `SELECT p.* FROM patients p ${where} ORDER BY LOWER(p.full_name) ASC`,
      params,
    );
    return rows.map(rowToPatient);
  }

  /** Etiquetas distintas usadas por los pacientes del dueño, ordenadas A→Z. */
  public async distinctTags(): Promise<string[]> {
    const rows = await this.db.query<{ tags_json: string }>(
      `SELECT tags_json FROM patients WHERE owner_user_id = ?`,
      [this.ownerUserId],
    );
    const tags = new Set<string>();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.tags_json) as unknown;
        if (Array.isArray(parsed)) {
          for (const tag of parsed) {
            if (typeof tag === 'string' && tag.trim().length > 0) tags.add(tag);
          }
        }
      } catch {
        // tags_json malformado: se ignora.
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'es'));
  }
}
