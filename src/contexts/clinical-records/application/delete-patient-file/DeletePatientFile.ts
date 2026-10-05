import type { PatientFileRepository } from '../../domain/repositories/PatientFileRepository';
import type { PatientFileStorage } from '../../domain/PatientFileStorage';
import { PatientFileNotFoundError } from '../../domain/errors/PatientFileNotFoundError';

export class DeletePatientFile {
  public constructor(
    private readonly files: PatientFileRepository,
    private readonly storage: PatientFileStorage,
  ) {}

  public async execute(fileId: string, patientId: string): Promise<void> {
    const file = await this.files.findById(fileId);
    if (!file || !file.belongsTo(patientId)) throw new PatientFileNotFoundError(fileId);
    await this.storage.delete(file.toPrimitives().storedPath);
    await this.files.delete(fileId);
  }
}
