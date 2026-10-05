import { DomainError } from '@/shared/domain/DomainError';

export class DiagnosisNotFoundError extends DomainError {
  public constructor(diagnosisId: string) {
    super(`No existe el diagnóstico "${diagnosisId}".`);
  }
}
