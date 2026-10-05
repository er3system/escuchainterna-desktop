import { DomainError } from '@/shared/domain/DomainError';

export class PatientIsNotArchivedError extends DomainError {
  public constructor(patientId: string) {
    super(`El paciente ${patientId} no está archivado; no se puede restaurar.`);
  }
}
