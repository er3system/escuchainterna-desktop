import { randomUUID } from 'node:crypto';
import { ReceivedConsent } from '../../domain/ReceivedConsent';
import { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import { ReceivedConsentDocument } from '../../domain/value-objects/ReceivedConsentDocument';
import type { ConsentInboxRepository } from '../../domain/repositories/ConsentInboxRepository';
import type { ConsentReceptionDocumentStorage } from '../../domain/ConsentReceptionDocumentStorage';
import type { ReceiveConsentDocumentMessage } from './ReceiveConsentDocumentMessage';
export class ReceiveConsentDocument {
  public constructor(private readonly inbox: ConsentInboxRepository, private readonly storage: ConsentReceptionDocumentStorage) {}
  public async receive(message: ReceiveConsentDocumentMessage): Promise<boolean> {
    const content = message.content.toPrimitives();
    if (await this.inbox.hasContent(content.hash)) return false;
    const id = new ConsentReceptionId(randomUUID());
    const patient = message.code ? await this.inbox.findPatientByReceptionCode(message.code) : null;
    const storedPath = await this.storage.save(id, message.content);
    try { await this.inbox.save(new ReceivedConsent(id, ReceivedConsentDocument.fromPrimitives({ ...content, storedPath }), new Date(), patient)); }
    catch (error) { await this.storage.delete(storedPath); throw error; }
    return true;
  }
}
