import { ConsentDocumentContent } from '../../domain/value-objects/ConsentDocumentContent';
import { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import type { ReceivedConsentMime } from '../../domain/value-objects/ReceivedConsentDocument';
export class ReceiveConsentDocumentMessage {
  public readonly content: ConsentDocumentContent;
  public readonly code: ConsentReceptionId | null;
  public constructor(filename: string, mime: ReceivedConsentMime, hash: string, data: Uint8Array, code: string | null) {
    this.content = new ConsentDocumentContent(filename, mime, hash, new Uint8Array(data)); this.code = code ? new ConsentReceptionId(code) : null;
  }
}
