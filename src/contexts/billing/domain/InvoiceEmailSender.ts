import { InvoiceEmail } from './InvoiceEmail';

/**
 * Puerto de envío del correo de factura. El adaptador local escribe en el
 * outbox (template `factura`) y devuelve el id del mensaje registrado.
 */
export interface InvoiceEmailSender {
  send(email: InvoiceEmail): Promise<string>;
}
