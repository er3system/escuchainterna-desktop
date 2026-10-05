import { DomainError } from '@/shared/domain/DomainError';

export class AccountSuspendedError extends DomainError {
  public constructor() {
    super('Tu cuenta está suspendida. Escríbenos a soporte@escuchainterna.com para reactivarla.');
  }
}
