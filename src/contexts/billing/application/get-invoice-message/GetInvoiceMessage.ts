import { InvoiceMessageView, InvoiceRepository } from '../../domain/repositories/InvoiceRepository';

// «Recibo DD/MM/AAAA» es la etiqueta vigente (v3 §7); «Factura …» se acepta
// como legado para etiquetas creadas antes del renombrado.
const TAG_DATE_PATTERN = /^(?:Recibo|Factura) (\d{2}\/\d{2}\/\d{4})$/;

/**
 * Resuelve el mensaje de recibo detrás de una etiqueta «Recibo DD/MM/AAAA»
 * del paciente (v2-spec §6.13: la etiqueta es clickeable y abre el envío).
 * Si la etiqueta no trae fecha (p. ej. «Recibo» sugerida) devuelve la última.
 */
export class GetInvoiceMessage {
  public constructor(private readonly invoices: InvoiceRepository) {}

  public async forPatientTag(input: { patientId: string; tag: string }): Promise<InvoiceMessageView | null> {
    const patientId = input.patientId.trim();
    if (!patientId) return null;
    const messages = await this.invoices.listMessagesForPatient(patientId);
    if (messages.length === 0) return null;

    const match = TAG_DATE_PATTERN.exec(input.tag.trim());
    if (!match) return messages[0];

    const wantedDate = match[1];
    return messages.find((message) => toDateLabel(message.sentAt) === wantedDate) ?? messages[0];
  }
}

function toDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
