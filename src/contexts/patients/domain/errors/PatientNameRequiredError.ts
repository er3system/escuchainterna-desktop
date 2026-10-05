import { DomainError } from '@/shared/domain/DomainError';

export class PatientNameRequiredError extends DomainError {
  public constructor() {
    super('falta el nombre del paciente');
  }
}
