import { FileTooLargeError } from '../../domain/errors/FileTooLargeError';
import { InvalidConsentAttachmentError } from '../../domain/errors/InvalidConsentAttachmentError';
import { sanitizeFilename } from '../upload-patient-file/UploadPatientFileMessage';

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export class AttachPaperConsentMessage {
  private readonly patientIdValue: string;
  private readonly filenameValue: string;
  private readonly mimeValue: string;
  private readonly dataValue: Uint8Array;

  public constructor(input: { patientId: string; filename: string; mime: string; data: Uint8Array }) {
    if (!input.patientId) throw new InvalidConsentAttachmentError('Falta el paciente del consentimiento.');
    const mime = (input.mime ?? '').trim();
    if (!mime.startsWith('image/') && mime !== 'application/pdf') {
      throw new InvalidConsentAttachmentError();
    }
    if (input.data.byteLength === 0) {
      throw new InvalidConsentAttachmentError('El archivo adjunto está vacío.');
    }
    if (input.data.byteLength > MAX_BYTES) {
      throw new FileTooLargeError(sanitizeFilename(input.filename ?? ''), MAX_MB);
    }
    this.patientIdValue = input.patientId;
    this.filenameValue = sanitizeFilename(input.filename ?? 'consentimiento-firmado');
    this.mimeValue = mime;
    this.dataValue = input.data;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public filename(): string {
    return this.filenameValue;
  }

  public mime(): string {
    return this.mimeValue;
  }

  public data(): Uint8Array {
    return this.dataValue;
  }
}
