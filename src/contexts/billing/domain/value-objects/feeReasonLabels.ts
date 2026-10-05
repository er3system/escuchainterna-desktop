// Módulo puro (sin dependencias de Node): etiquetas de las tarifas por
// inasistencia / cancelación tardía, usables desde client components.

export type FeeReasonValue = 'inasistencia' | 'cancelacion_tardia';

export const FEE_REASON_LABELS: Record<FeeReasonValue, string> = {
  inasistencia: 'Tarifa por inasistencia',
  cancelacion_tardia: 'Tarifa por cancelación tardía',
};

export function isFeeReason(value: string): value is FeeReasonValue {
  return value === 'inasistencia' || value === 'cancelacion_tardia';
}

export function feeReasonLabelFor(value: string): string | null {
  return isFeeReason(value) ? FEE_REASON_LABELS[value] : null;
}
