import type { PatientFilePrimitives } from '../../domain/PatientFile';
import type { PatientFileRepository } from '../../domain/repositories/PatientFileRepository';

export class ListPatientFiles {
  public constructor(private readonly files: PatientFileRepository) {}

  /** Archivos del paciente, más recientes primero. */
  public async execute(patientId: string): Promise<PatientFilePrimitives[]> {
    const files = await this.files.listByPatient(patientId);
    return files
      .map((file) => file.toPrimitives())
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
}
