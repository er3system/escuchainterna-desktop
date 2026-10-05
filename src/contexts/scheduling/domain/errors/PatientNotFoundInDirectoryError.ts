import { DomainError } from '@/shared/domain/DomainError';

export class PatientNotFoundInDirectoryError extends DomainError {
  public constructor(patientId: string) {
    super(`No existe el paciente «${patientId}» en el directorio.`);
  }
}
