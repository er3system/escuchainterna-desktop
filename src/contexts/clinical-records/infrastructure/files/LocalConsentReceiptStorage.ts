import type { ConsentReceptionDocumentStorage } from '../../domain/ConsentReceptionDocumentStorage';
import type { ConsentReceptionId } from '../../domain/value-objects/ConsentReceptionId';
import type { ConsentDocumentContent } from '../../domain/value-objects/ConsentDocumentContent';
import { LocalPatientFileStorage } from './LocalPatientFileStorage';
export class LocalConsentReceiptStorage implements ConsentReceptionDocumentStorage {
  private readonly files = new LocalPatientFileStorage();
  public constructor(private readonly owner: string) {}
  public save(id: ConsentReceptionId, content: ConsentDocumentContent): Promise<string> {
    const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[content.toPrimitives().mime];
    return this.files.save(`consentimientos/${this.owner}/${id.toString()}`, `documento.${extension}`, content.bytes());
  }
  public delete(storedPath: string): Promise<void> { return this.files.delete(storedPath); }
}
