import { DomainError } from '@/shared/domain/DomainError';

export class InvalidPaymentMethodError extends DomainError {
  public constructor(value: string) {
    super(`«${value}» no es un método de pago válido. Usa transferencia, efectivo, tarjeta o stripe.`);
  }
}
