import { DomainError } from '@/shared/domain/DomainError';

export class PatientAlreadyArchivedError extends DomainError {
  public constructor(patientId: string) {
    super(`El paciente ${patientId} ya está archivado.`);
  }
}
