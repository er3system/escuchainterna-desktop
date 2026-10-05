import { DomainError } from '@/shared/domain/DomainError';

export class ClinicalRecordNotFoundError extends DomainError {
  public constructor(recordId: string) {
    super(`No existe la historia clínica "${recordId}".`);
  }
}
