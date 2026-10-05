import { randomUUID } from 'node:crypto';
import { PatientFile } from '../../domain/PatientFile';
import type { PatientFileRepository } from '../../domain/repositories/PatientFileRepository';
import type { PatientFileStorage } from '../../domain/PatientFileStorage';
import type { UploadPatientFileMessage } from './UploadPatientFileMessage';

export class UploadPatientFile {
  public constructor(
    private readonly files: PatientFileRepository,
    private readonly storage: PatientFileStorage,
  ) {}

  public async execute(message: UploadPatientFileMessage): Promise<string> {
    const storedPath = await this.storage.save(message.patientId(), message.filename(), message.data());
    const file = PatientFile.upload({
      id: randomUUID(),
      patientId: message.patientId(),
      filename: message.filename(),
      storedPath,
      mime: message.mime(),
      size: message.data().byteLength,
    });
    await this.files.save(file);
    return file.fileId();
  }
}
