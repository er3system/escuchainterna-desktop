import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { isConsentStatus, type ConsentSignatureKind } from '../../domain/value-objects/consentStatus';
import { PatientConsent } from '../../domain/PatientConsent';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';

export interface PatientConsentRow {
  id: string;
  patient_id: string;
  token: string;
  template_title: string;
  template_body: string;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string;
  signature_kind: string;
  file_path: string | null;
  created_at: string;
  revoked_at: string | null;
  ai_authorized: number;
}

/** Cifrado at-rest (v3 §1.1): template_body y signed_name viajan cifrados a la tabla. */
export function consentRowToAggregate(row: PatientConsentRow): PatientConsent {
  return PatientConsent.fromPrimitives({
    id: row.id,
    patientId: row.patient_id,
    token: row.token,
    templateTitle: row.template_title,
    templateBody: decryptField(row.template_body),
    status: isConsentStatus(row.status) ? row.status : 'pendiente',
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    signedName: decryptField(row.signed_name),
    signatureKind: (row.signature_kind === 'digital' || row.signature_kind === 'papel'
      ? row.signature_kind
      : '') as ConsentSignatureKind,
    filePath: row.file_path,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    aiAuthorized: row.ai_authorized === 1,
  });
}

export async function persistConsent(
  consent: PatientConsent,
  ownerUserId: string,
  db: DatabaseAdapter = getDatabaseAdapter(),
): Promise<void> {
  const primitives = consent.toPrimitives();
  await db.execute(
    `INSERT INTO patient_consents
         (id, patient_id, owner_user_id, token, template_title, template_body, status,
          sent_at, signed_at, signed_name, signature_kind, file_path, created_at, revoked_at, ai_authorized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         owner_user_id = excluded.owner_user_id,
         token = excluded.token,
         template_title = excluded.template_title,
         template_body = excluded.template_body,
         status = excluded.status,
         sent_at = excluded.sent_at,
         signed_at = excluded.signed_at,
         signed_name = excluded.signed_name,
         signature_kind = excluded.signature_kind,
         file_path = excluded.file_path,
         created_at = excluded.created_at,
         revoked_at = excluded.revoked_at,
         ai_authorized = excluded.ai_authorized`,
    [
      primitives.id,
      primitives.patientId,
      ownerUserId,
      primitives.token,
      primitives.templateTitle,
      encryptField(primitives.templateBody),
      primitives.status,
      primitives.sentAt,
      primitives.signedAt,
      encryptField(primitives.signedName),
      primitives.signatureKind,
      primitives.filePath,
      primitives.createdAt,
      primitives.revokedAt ?? null,
      primitives.aiAuthorized ? 1 : 0,
    ],
  );
}

/** Consentimientos acotados al dueño (owner_user_id) de la sesión. */
export class SqlitePatientConsentRepository implements PatientConsentRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(consent: PatientConsent): Promise<void> {
    await persistConsent(consent, this.ownerUserId, this.db);
  }

  public async findById(id: string): Promise<PatientConsent | null> {
    const row = await this.db.queryRow<PatientConsentRow>(
      'SELECT * FROM patient_consents WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? consentRowToAggregate(row) : null;
  }

  public async findLatestByPatient(patientId: string): Promise<PatientConsent | null> {
    const row = await this.db.queryRow<PatientConsentRow>(
      `SELECT * FROM patient_consents
          WHERE patient_id = ? AND owner_user_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
      [patientId, this.ownerUserId],
    );
    return row ? consentRowToAggregate(row) : null;
  }

  public async listByPatient(patientId: string): Promise<PatientConsent[]> {
    const rows = await this.db.query<PatientConsentRow>(
      `SELECT * FROM patient_consents
          WHERE patient_id = ? AND owner_user_id = ?
          ORDER BY created_at DESC, id DESC`,
      [patientId, this.ownerUserId],
    );
    return rows.map(consentRowToAggregate);
  }
}
