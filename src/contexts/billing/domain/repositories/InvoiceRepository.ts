import { Invoice } from '../Invoice';

/** Vista del mensaje de factura enviado (para la etiqueta clickeable). */
export interface InvoiceMessageView {
  folio: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface InvoiceRepository {
  /** Siguiente consecutivo del folio EI-<año>-<seq> para el profesional. */
  nextSequenceForYear(year: number): Promise<number>;
  save(invoice: Invoice): Promise<void>;
  /** Mensajes de factura del paciente, del más reciente al más antiguo. */
  listMessagesForPatient(patientId: string): Promise<InvoiceMessageView[]>;
}
