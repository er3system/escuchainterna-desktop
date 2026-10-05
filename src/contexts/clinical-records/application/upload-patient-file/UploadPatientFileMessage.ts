import { FileTooLargeError } from '../../domain/errors/FileTooLargeError';

export const MAX_PATIENT_FILE_MB = 20;
const MAX_BYTES = MAX_PATIENT_FILE_MB * 1024 * 1024;

/** Sanea el nombre: sin rutas, sin caracteres raros, longitud acotada. */
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._\- ()]/gu, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const limited = cleaned.length > 120 ? cleaned.slice(cleaned.length - 120) : cleaned;
  return limited === '' || limited === '.' || limited === '..' ? 'archivo' : limited;
}

export class UploadPatientFileMessage {
  private readonly patientIdValue: string;
  private readonly filenameValue: string;
  private readonly mimeValue: string;
  private readonly dataValue: Uint8Array;

  public constructor(input: { patientId: string; filename: string; mime: string; data: Uint8Array }) {
    if (!input.patientId) throw new Error('Falta el paciente para subir el archivo.');
    this.patientIdValue = input.patientId;
    this.filenameValue = sanitizeFilename(input.filename ?? '');
    this.mimeValue = input.mime && input.mime.trim() !== '' ? input.mime : 'application/octet-stream';
    if (input.data.byteLength > MAX_BYTES) {
      throw new FileTooLargeError(this.filenameValue, MAX_PATIENT_FILE_MB);
    }
    if (input.data.byteLength === 0) {
      throw new Error(`El archivo "${this.filenameValue}" está vacío.`);
    }
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
