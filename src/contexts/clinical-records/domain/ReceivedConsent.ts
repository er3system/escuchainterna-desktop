import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { ConsentReceiptAlreadyReviewedError } from './errors/ConsentReceiptAlreadyReviewedError';
import { ConsentReceptionId } from './value-objects/ConsentReceptionId';
import { ConsentSignatureDate } from './value-objects/ConsentSignatureDate';
import { ReceivedConsentDocument, type ReceivedConsentDocumentPrimitives } from './value-objects/ReceivedConsentDocument';
export interface ReceivedConsentPrimitives { id: string; document: ReceivedConsentDocumentPrimitives; receivedAt: string; status: 'pendiente' | 'archivado' | 'descartado'; suggestedPatientId: string | null; patientId: string | null; consentId: string | null; signedDate: string | null; reviewedAt: string | null; }
/** La recepción es evidencia pendiente; solo la revisión concede el consentimiento. */
export class ReceivedConsent extends AggregateRoot {
  private status: ReceivedConsentPrimitives['status'] = 'pendiente';
  private patientId: ConsentReceptionId | null = null;
  private consentId: ConsentReceptionId | null = null;
  private signedDate: ConsentSignatureDate | null = null;
  private reviewedAt: Date | null = null;
  public constructor(private readonly id: ConsentReceptionId, private readonly document: ReceivedConsentDocument, private readonly receivedAt: Date, private readonly suggestedPatientId: ConsentReceptionId | null) { super(); }
  public identity(): ConsentReceptionId { return this.id; }
  public documentForReview(): ReceivedConsentDocument { this.assertPending(); return this.document; }
  public assertPending(): void { if (this.status !== 'pendiente') throw new ConsentReceiptAlreadyReviewedError(); }
  public archive(patientId: ConsentReceptionId, consentId: ConsentReceptionId, signedDate: ConsentSignatureDate): void {
    this.assertPending(); this.status = 'archivado'; this.patientId = patientId; this.consentId = consentId; this.signedDate = signedDate; this.reviewedAt = new Date();
  }
  public dismiss(): void { this.assertPending(); this.status = 'descartado'; this.reviewedAt = new Date(); }
  public toPrimitives(): ReceivedConsentPrimitives { return { id: this.id.toString(), document: this.document.toPrimitives(), receivedAt: this.receivedAt.toISOString(), status: this.status, suggestedPatientId: this.suggestedPatientId?.toString() ?? null, patientId: this.patientId?.toString() ?? null, consentId: this.consentId?.toString() ?? null, signedDate: this.signedDate?.toString() ?? null, reviewedAt: this.reviewedAt?.toISOString() ?? null }; }
  public static fromPrimitives(p: ReceivedConsentPrimitives): ReceivedConsent {
    const receipt = new ReceivedConsent(new ConsentReceptionId(p.id), ReceivedConsentDocument.fromPrimitives(p.document), new Date(p.receivedAt), p.suggestedPatientId ? new ConsentReceptionId(p.suggestedPatientId) : null);
    receipt.status = p.status; receipt.patientId = p.patientId ? new ConsentReceptionId(p.patientId) : null; receipt.consentId = p.consentId ? new ConsentReceptionId(p.consentId) : null; receipt.signedDate = p.signedDate ? new ConsentSignatureDate(p.signedDate) : null; receipt.reviewedAt = p.reviewedAt ? new Date(p.reviewedAt) : null;
    return receipt;
  }
}
