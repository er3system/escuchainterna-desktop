import { randomBytes, randomUUID } from 'node:crypto';
import { PatientConsent } from '../../domain/PatientConsent';
import { ConsentNotFoundError } from '../../domain/errors/ConsentNotFoundError';
import { InvalidConsentAttachmentError } from '../../domain/errors/InvalidConsentAttachmentError';
import { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import type { ConsentInboxRepository } from '../../domain/repositories/ConsentInboxRepository';
import type { PatientConsentRepository } from '../../domain/repositories/PatientConsentRepository';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ReviewReceivedConsentMessage } from './ReviewReceivedConsentMessage';
/** Los tres repositorios y la transacción comparten el mismo adaptador. */
export class ReviewReceivedConsent {
  public constructor(private readonly inbox: ConsentInboxRepository, private readonly consents: PatientConsentRepository, private readonly patients: PatientDirectory, private readonly transaction: <T>(work: () => Promise<T>) => Promise<T>) {}
  public async review(message: ReviewReceivedConsentMessage): Promise<void> {
    await this.transaction(async () => {
      const receipt = await this.inbox.find(message.receiptId);
      if (!receipt) throw new ConsentNotFoundError();
      receipt.assertPending();
      if (!await this.patients.findSummary(message.patientId.toString())) throw new InvalidConsentAttachmentError('El paciente no está disponible en tu consulta.');
      const id = new ConsentReceptionId(randomUUID());
      const consent = PatientConsent.recordReviewedDocument(id, message.patientId, randomBytes(24).toString('base64url'), receipt, message.signedDate);
      receipt.archive(message.patientId, id, message.signedDate);
      await this.consents.save(consent); await this.inbox.save(receipt);
    });
  }
}
