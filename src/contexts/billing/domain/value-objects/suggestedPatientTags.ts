// Módulo puro (sin dependencias de Node): etiquetas sugeridas para pacientes
// en el módulo de pagos (v2-spec §6.13; renombrado factura→recibo en v3 §7).

export const SUGGESTED_PATIENT_TAGS: string[] = [
  'Primera vez',
  'Pago anticipado',
  'Recibo',
  'No contesta',
  'Paga tarde',
  'Paquete 4',
  'Paquete 10',
  'Descuento',
  'Aseguradora',
  'Estudiante',
  'Adeudo',
  'VIP',
];

// «Factura …» se acepta como legado: etiquetas creadas antes del renombrado
// de la v3 siguen siendo clickeables y resolubles.
const INVOICE_TAG_PATTERN = /^(?:Recibo|Factura)( \d{2}\/\d{2}\/\d{4})?$/;

/** ¿La etiqueta corresponde a un recibo enviado («Recibo DD/MM/AAAA»)? */
export function isInvoiceTag(tag: string): boolean {
  return INVOICE_TAG_PATTERN.test(tag.trim());
}

/** Construye la etiqueta automática de recibo para una fecha ya formateada DD/MM/AAAA. */
export function invoiceTagFor(dateLabel: string): string {
  return `Recibo ${dateLabel}`;
}
