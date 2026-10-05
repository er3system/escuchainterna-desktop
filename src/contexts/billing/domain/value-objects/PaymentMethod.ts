import { Enum } from '@haskou/value-objects';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
  allPaymentMethods,
  isValidPaymentMethod,
  paymentMethodLabelFor,
  type PaymentMethodValue,
} from './paymentMethodLabels';

export type { PaymentMethodValue };

export class PaymentMethod extends Enum<PaymentMethodValue> {
  public getValues(): PaymentMethodValue[] {
    return PAYMENT_METHOD_VALUES;
  }

  public label(): string {
    return PAYMENT_METHOD_LABELS[this.valueOf()];
  }

  public static isValid(value: string): value is PaymentMethodValue {
    return isValidPaymentMethod(value);
  }

  public static all(): Array<{ value: PaymentMethodValue; label: string }> {
    return allPaymentMethods();
  }

  public static labelFor(value: string | null): string {
    return paymentMethodLabelFor(value);
  }
}
