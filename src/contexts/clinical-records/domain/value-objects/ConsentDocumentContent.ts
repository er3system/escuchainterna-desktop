import { InvalidConsentAttachmentError } from '../errors/InvalidConsentAttachmentError';
import type { ReceivedConsentMime } from './ReceivedConsentDocument';
export class ConsentDocumentContent {
  public constructor(private readonly filename: string, private readonly mime: ReceivedConsentMime, private readonly hash: string, private readonly data: Uint8Array) {
    if (!filename || filename.length > 240 || /[\x00-\x1f]/.test(filename) || !['application/pdf','image/png','image/jpeg','image/webp'].includes(mime) || !/^[a-f0-9]{64}$/.test(hash) || data.byteLength === 0 || data.byteLength > 20*1024*1024) throw new InvalidConsentAttachmentError();
  }
  public bytes(): Uint8Array { return new Uint8Array(this.data); }
  public toPrimitives(): { filename: string; mime: ReceivedConsentMime; hash: string } { return { filename: this.filename, mime: this.mime, hash: this.hash }; }
}
