import { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import { ConsentSignatureDate } from '../../domain/value-objects/ConsentSignatureDate';
import { InvalidConsentAttachmentError } from '../../domain/errors/InvalidConsentAttachmentError';
export class ReviewReceivedConsentMessage {
  public readonly receiptId: ConsentReceptionId;
  public readonly patientId: ConsentReceptionId;
  public readonly signedDate: ConsentSignatureDate;
  public constructor(receiptId: string, patientId: string, signedDate: string, confirmed: boolean) {
    if (!confirmed) throw new InvalidConsentAttachmentError('Confirma que revisaste la firma y que el documento corresponde al paciente.');
    this.receiptId = new ConsentReceptionId(receiptId); this.patientId = new ConsentReceptionId(patientId); this.signedDate = new ConsentSignatureDate(signedDate);
  }
}
