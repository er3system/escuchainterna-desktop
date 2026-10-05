// Módulo puro (sin dependencias de Node) para que los client components
// puedan usar los métodos de pago sin arrastrar @haskou/value-objects
// (que importa node:crypto) al bundle del navegador.

export type PaymentMethodValue =
  | 'transferencia'
  | 'efectivo'
  | 'tarjeta'
  | 'stripe'
  | 'mercado_pago'
  | 'paypal';

export const PAYMENT_METHOD_VALUES: PaymentMethodValue[] = [
  'transferencia',
  'efectivo',
  'tarjeta',
  'stripe',
  'mercado_pago',
  'paypal',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  transferencia: 'Transferencia bancaria',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  stripe: 'Stripe',
  mercado_pago: 'Mercado Pago',
  paypal: 'PayPal',
};

export function isValidPaymentMethod(value: string): value is PaymentMethodValue {
  return (PAYMENT_METHOD_VALUES as string[]).includes(value);
}

export function allPaymentMethods(): Array<{ value: PaymentMethodValue; label: string }> {
  return PAYMENT_METHOD_VALUES.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
}

export function paymentMethodLabelFor(value: string | null): string {
  if (!value || !isValidPaymentMethod(value)) return '—';
  return PAYMENT_METHOD_LABELS[value];
}
