import { DomainError } from '@/shared/domain/DomainError';

export class PatientFileNotFoundError extends DomainError {
  public constructor(fileId: string) {
    super(`No existe el archivo "${fileId}".`);
  }
}
