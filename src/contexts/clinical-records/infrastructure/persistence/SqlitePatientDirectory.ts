import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import {
  decryptPatientRow,
  documentBlindIndex,
} from '@/shared/infrastructure/persistence/patientPiiEncryption';
import type {
  PatientCustomField,
  PatientDirectory,
  PatientSummary,
  PatientSummaryUpdate,
} from '../../domain/repositories/PatientDirectory';

/** Parsea custom_fields_json a pares {label,value} válidos (defensivo). */
function parseCustomFields(json: string): PatientCustomField[] {
  try {
    const parsed = JSON.parse(json || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { label: unknown; value: unknown } => typeof item === 'object' && item !== null)
      .map((item) => ({ label: String(item.label ?? ''), value: String(item.value ?? '') }))
      .filter((field) => field.label.trim() !== '');
  } catch {
    return [];
  }
}

interface PatientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  birth_date: string | null;
  gender: string;
  consultation_reason: string;
  therapy_start_date: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  tags_json: string;
  document_type: string;
  document_number: string;
  guardian_name: string;
  guardian_relationship: string;
  guardian_document: string;
  current_medication: string;
  medical_history: string;
  session_frequency: string;
  session_modality: string;
  process_status: string;
  treatment_end_date: string | null;
  treatment_end_reason: string;
  insurance_name: string;
  insurance_policy_number: string;
  referral_source: string;
  custom_fields_json: string;
  archived: number;
  created_at: string;
}

/**
 * Read model propio del expediente sobre la tabla `patients`
 * (sin depender del contexto patients), acotado al dueño de la sesión.
 */
export class SqlitePatientDirectory implements PatientDirectory {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findSummary(patientId: string): Promise<PatientSummary | null> {
    const row = await this.db.queryRow<PatientRow>(
      'SELECT * FROM patients WHERE id = ? AND owner_user_id = ?',
      [patientId, this.ownerUserId],
    );
    if (!row) return null;
    // Descifra las columnas PII at-rest antes de mapear (tolerante con datos previos).
    decryptPatientRow(row);
    let tags: string[] = [];
    try {
      const parsed = JSON.parse(row.tags_json) as unknown;
      if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === 'string');
    } catch {
      tags = [];
    }
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      birthDate: row.birth_date,
      gender: row.gender,
      consultationReason: row.consultation_reason,
      therapyStartDate: row.therapy_start_date,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      notes: row.notes,
      tags,
      documentType: row.document_type ?? '',
      documentNumber: row.document_number ?? '',
      guardianName: row.guardian_name ?? '',
      guardianRelationship: row.guardian_relationship ?? '',
      guardianDocument: row.guardian_document ?? '',
      currentMedication: row.current_medication ?? '',
      medicalHistory: row.medical_history ?? '',
      sessionFrequency: row.session_frequency ?? '',
      sessionModality: row.session_modality ?? '',
      processStatus: row.process_status || 'activo',
      treatmentEndDate: row.treatment_end_date,
      treatmentEndReason: row.treatment_end_reason ?? '',
      insuranceName: row.insurance_name ?? '',
      insurancePolicyNumber: row.insurance_policy_number ?? '',
      referralSource: row.referral_source ?? '',
      customFields: parseCustomFields(row.custom_fields_json),
      archived: row.archived === 1,
      createdAt: row.created_at,
    };
  }

  public async updateSummary(patientId: string, update: PatientSummaryUpdate): Promise<void> {
    await this.db.execute(
      `UPDATE patients SET
           full_name = ?,
           email = ?,
           phone = ?,
           birth_date = ?,
           gender = ?,
           consultation_reason = ?,
           therapy_start_date = ?,
           emergency_contact_name = ?,
           emergency_contact_phone = ?,
           notes = ?,
           tags_json = ?,
           document_type = ?,
           document_number = ?,
           document_hash = ?,
           guardian_name = ?,
           guardian_relationship = ?,
           guardian_document = ?,
           current_medication = ?,
           medical_history = ?,
           session_frequency = ?,
           session_modality = ?,
           process_status = ?,
           treatment_end_date = ?,
           treatment_end_reason = ?,
           insurance_name = ?,
           insurance_policy_number = ?,
           referral_source = ?,
           custom_fields_json = ?
         WHERE id = ? AND owner_user_id = ?`,
      [
        update.fullName,
        update.email,
        update.phone,
        update.birthDate,
        update.gender,
        // Columnas PII cifradas at-rest (las que NO se consultan por valor).
        encryptField(update.consultationReason ?? ''),
        update.therapyStartDate,
        encryptField(update.emergencyContactName ?? ''),
        encryptField(update.emergencyContactPhone ?? ''),
        encryptField(update.notes ?? ''),
        JSON.stringify(update.tags),
        update.documentType,
        encryptField(update.documentNumber ?? ''),
        // Índice ciego del documento para deduplicar sin guardarlo en claro.
        documentBlindIndex(update.documentNumber ?? ''),
        encryptField(update.guardianName ?? ''),
        encryptField(update.guardianRelationship ?? ''),
        encryptField(update.guardianDocument ?? ''),
        encryptField(update.currentMedication ?? ''),
        encryptField(update.medicalHistory ?? ''),
        update.sessionFrequency,
        update.sessionModality,
        update.processStatus,
        update.treatmentEndDate,
        encryptField(update.treatmentEndReason ?? ''),
        encryptField(update.insuranceName ?? ''),
        encryptField(update.insurancePolicyNumber ?? ''),
        encryptField(update.referralSource ?? ''),
        encryptField(JSON.stringify(update.customFields ?? [])),
        patientId,
        this.ownerUserId,
      ],
    );
  }

  /**
   * Dueño y organización de un paciente SIN filtrar por dueño. Es una lectura
   * deliberadamente transversal, usada SOLO por el resolutor de cobertura (§2.4)
   * para decidir si un actor de la misma organización puede acceder. No expone
   * datos clínicos; solo los identificadores de custodia.
   */
  public async findOwnership(
    patientId: string,
  ): Promise<{ ownerUserId: string; organizationId: string | null } | null> {
    const row = await this.db.queryRow<{ owner_user_id: string; organization_id: string | null }>(
      'SELECT owner_user_id, organization_id FROM patients WHERE id = ?',
      [patientId],
    );
    return row ? { ownerUserId: row.owner_user_id, organizationId: row.organization_id ?? null } : null;
  }

  public async findDuplicateByDocument(
    documentNumber: string,
    exceptPatientId?: string,
  ): Promise<{ id: string; fullName: string } | null> {
    const trimmed = documentNumber.trim();
    if (!trimmed) return null;
    // document_number está cifrado at-rest (IV aleatorio): no se puede comparar por igualdad.
    // Se busca por el índice ciego document_hash (HMAC determinista del documento). full_name
    // NO está cifrado (queda en claro para búsqueda/orden), así que se devuelve tal cual.
    const row = await this.db.queryRow<{ id: string; full_name: string }>(
      `SELECT id, full_name FROM patients
         WHERE owner_user_id = ? AND document_hash = ? AND id != ?
         LIMIT 1`,
      [this.ownerUserId, documentBlindIndex(trimmed), exceptPatientId ?? ''],
    );
    return row ? { id: row.id, fullName: row.full_name } : null;
  }
}
