import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface PatientFilePrimitives {
  id: string;
  patientId: string;
  filename: string;
  storedPath: string;
  mime: string;
  size: number;
  uploadedAt: string;
}

/** Archivo adjunto al expediente de un paciente (guardado en data/uploads/<patientId>/). */
export class PatientFile extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly filename: string,
    private readonly storedPath: string,
    private readonly mime: string,
    private readonly size: number,
    private readonly uploadedAt: Date,
  ) {
    super();
  }

  public static upload(input: {
    id: string;
    patientId: string;
    filename: string;
    storedPath: string;
    mime: string;
    size: number;
  }): PatientFile {
    return new PatientFile(input.id, input.patientId, input.filename, input.storedPath, input.mime, input.size, new Date());
  }

  public static fromPrimitives(primitives: PatientFilePrimitives): PatientFile {
    return new PatientFile(
      primitives.id,
      primitives.patientId,
      primitives.filename,
      primitives.storedPath,
      primitives.mime,
      primitives.size,
      new Date(primitives.uploadedAt),
    );
  }

  public fileId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public toPrimitives(): PatientFilePrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      filename: this.filename,
      storedPath: this.storedPath,
      mime: this.mime,
      size: this.size,
      uploadedAt: this.uploadedAt.toISOString(),
    };
  }
}
