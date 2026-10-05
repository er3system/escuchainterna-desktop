import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { encryptField, decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { ReceivedConsent, type ReceivedConsentPrimitives } from '../../domain/ReceivedConsent';
import { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import type { ConsentInboxRepository } from '../../domain/repositories/ConsentInboxRepository';
interface ReceiptRow { id: string; document_json: string; received_at: string; status: ReceivedConsentPrimitives['status']; suggested_patient_id: string | null; patient_id: string | null; consent_id: string | null; signed_date: string | null; reviewed_at: string | null; }
export function receiptFromRow(row: ReceiptRow): ReceivedConsent {
  return ReceivedConsent.fromPrimitives({ id: row.id, document: JSON.parse(decryptField(row.document_json)), receivedAt: row.received_at, status: row.status, suggestedPatientId: row.suggested_patient_id, patientId: row.patient_id, consentId: row.consent_id, signedDate: row.signed_date, reviewedAt: row.reviewed_at });
}
export class SqliteConsentInboxRepository implements ConsentInboxRepository {
  public constructor(private readonly owner: string, private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}
  public async find(id: ConsentReceptionId): Promise<ReceivedConsent | null> {
    const row = await this.db.queryRow<ReceiptRow>('SELECT * FROM received_consents WHERE id = ? AND owner_user_id = ?', [id.toString(), this.owner]);
    return row ? receiptFromRow(row) : null;
  }
  public async hasContent(hash: string): Promise<boolean> { return !!await this.db.queryRow('SELECT id FROM received_consents WHERE owner_user_id = ? AND content_hash = ?', [this.owner, hash]); }
  public async save(receipt: ReceivedConsent): Promise<void> {
    const p = receipt.toPrimitives();
    await this.db.execute(`INSERT INTO received_consents (id, owner_user_id, content_hash, document_json, received_at, status, suggested_patient_id, patient_id, consent_id, signed_date, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, patient_id=excluded.patient_id, consent_id=excluded.consent_id, signed_date=excluded.signed_date, reviewed_at=excluded.reviewed_at WHERE received_consents.owner_user_id=excluded.owner_user_id`, [p.id, this.owner, p.document.hash, encryptField(JSON.stringify(p.document)), p.receivedAt, p.status, p.suggestedPatientId, p.patientId, p.consentId, p.signedDate, p.reviewedAt]);
  }
  public async list(): Promise<ReceivedConsentPrimitives[]> { return (await this.db.query<ReceiptRow>("SELECT * FROM received_consents WHERE owner_user_id = ? ORDER BY CASE WHEN status='pendiente' THEN 0 ELSE 1 END, received_at DESC LIMIT 200", [this.owner])).map(row => receiptFromRow(row).toPrimitives()); }
  public async pendingCount(): Promise<number> { return (await this.db.queryRow<{n:number}>("SELECT COUNT(*) AS n FROM received_consents WHERE owner_user_id=? AND status='pendiente'", [this.owner]))?.n ?? 0; }
  public async patientForCode(code: string): Promise<string | null> { return (await this.db.queryRow<{ patient_id: string }>('SELECT c.patient_id FROM consent_reception_codes c JOIN patients p ON p.id=c.patient_id AND p.owner_user_id=c.owner_user_id WHERE c.code=? AND c.owner_user_id=?', [code, this.owner]))?.patient_id ?? null; }
  public async findPatientByReceptionCode(code: ConsentReceptionId): Promise<ConsentReceptionId | null> { const patient = await this.patientForCode(code.toString()); return patient ? new ConsentReceptionId(patient) : null; }
  public async codeForPatient(patientId: string): Promise<string> {
    if (!await this.db.queryRow('SELECT id FROM patients WHERE id=? AND owner_user_id=?', [patientId, this.owner])) throw new Error('El paciente no está disponible en tu consulta.');
    await this.db.execute('INSERT INTO consent_reception_codes (code, owner_user_id, patient_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_user_id, patient_id) DO NOTHING', [randomUUID(), this.owner, patientId, new Date().toISOString()]);
    return (await this.db.queryRow<{ code: string }>('SELECT code FROM consent_reception_codes WHERE owner_user_id=? AND patient_id=?', [this.owner, patientId]))!.code;
  }
}
