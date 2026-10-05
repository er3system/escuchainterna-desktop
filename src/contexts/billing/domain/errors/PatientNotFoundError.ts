import { DomainError } from '@/shared/domain/DomainError';

export class PatientNotFoundError extends DomainError {
  public constructor(patientId: string) {
    super(`No existe el paciente «${patientId}».`);
  }
}
