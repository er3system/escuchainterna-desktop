import { DomainError } from '@/shared/domain/DomainError';

export class PatientInInstitutionalCustodyIsReadOnlyError extends DomainError {
  public constructor(patientId: string) {
    super(`El paciente ${patientId} está bajo custodia institucional y su expediente es de solo lectura.`);
  }
}
