import { InvalidConsentAttachmentError } from '../errors/InvalidConsentAttachmentError';
export type ReceivedConsentMime = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
export interface ReceivedConsentDocumentPrimitives { filename: string; mime: ReceivedConsentMime; hash: string; storedPath: string; }
export class ReceivedConsentDocument {
  public constructor(private readonly filename: string, private readonly mime: ReceivedConsentMime, private readonly hash: string, private readonly storedPath: string) {
    if (!filename || filename.length > 240 || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mime) || !/^[a-f0-9]{64}$/.test(hash) || !storedPath || storedPath.includes('..')) throw new InvalidConsentAttachmentError();
  }
  public sameContent(other: ReceivedConsentDocument): boolean { return this.hash === other.hash; }
  public location(): string { return this.storedPath; }
  public toPrimitives(): ReceivedConsentDocumentPrimitives { return { filename: this.filename, mime: this.mime, hash: this.hash, storedPath: this.storedPath }; }
  public static fromPrimitives(p: ReceivedConsentDocumentPrimitives): ReceivedConsentDocument { return new ReceivedConsentDocument(p.filename, p.mime, p.hash, p.storedPath); }
}
