import { DomainError } from '@/shared/domain/DomainError';

export class InvalidPatientEmailError extends DomainError {
  public constructor(value: string) {
    super(`correo electrónico inválido: «${value}»`);
  }
}
