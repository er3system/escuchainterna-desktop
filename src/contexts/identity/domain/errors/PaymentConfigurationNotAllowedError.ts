import { DomainError } from '@/shared/domain/DomainError';

export class PaymentConfigurationNotAllowedError extends DomainError {
  public constructor() {
    super('La organización administra la configuración de pagos de esta cuenta.');
  }
}
