import { EMAIL_FROM, emailChannel } from '../config/channels';
import { isDesktopEdition } from '../config/desktopEdition';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';

export interface TransactionalEmail {
  to: string;
  subject: string;
  /** Cuerpo en texto plano (se envía como texto y como HTML con saltos de línea). */
  body: string;
}

export interface EmailSendResult {
  sent: boolean;
  /** Motivo cuando no se envió: 'sin_proveedor' (canal dormido) o el error. */
  reason?: string;
}

/**
 * Envío REAL de correo transaccional vía Resend. Está DORMIDO hasta que exista
 * RESEND_API_KEY: sin la clave devuelve { sent:false, reason:'sin_proveedor' } y el
 * outbox queda como único registro. Con la clave, envía de verdad. Este es el "canal
 * listo": conectar el proveedor = definir la variable de entorno, sin tocar código.
 *
 * Resend es un POST HTTPS simple; sustituirlo por otro SMTP/API es cambiar este archivo.
 */
export async function sendTransactionalEmail(email: TransactionalEmail, ownerUserId?: string): Promise<EmailSendResult> {
  try {
    const personal = isDesktopEdition() && ownerUserId ? await new SqlitePersonalProviderRepository().find(ownerUserId, 'resend') : null;
    const apiKey = isDesktopEdition() ? personal?.api_key : process.env.RESEND_API_KEY;
    const sender = isDesktopEdition() ? personal?.sender : EMAIL_FROM;
    if (!apiKey || !sender || (!isDesktopEdition() && !emailChannel().configured)) return { sent: false, reason: 'sin_proveedor' };
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [email.to],
        subject: email.subject.trim() || 'Mensaje de EscuchaInterna',
        text: email.body,
        html: /<html[\s>]/i.test(email.body) ? email.body : email.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'),
      }),
    });
    if (!response.ok) return { sent: false, reason: `Resend respondió ${response.status}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: 'No se pudo contactar con Resend.' };
  }
}
