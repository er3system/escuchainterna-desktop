import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { sendTransactionalEmail } from '../notifications/ResendEmailSender';

export type OutboxChannel = 'whatsapp' | 'email';

export type OutboxTemplate =
  | 'sesion_agendada'
  | 'recordatorio_sesion'
  | 'sesion_reagendada'
  | 'sesion_cancelada'
  | 'recordatorio_pago'
  | 'cumpleanios'
  | 'reactivacion'
  | 'correo_masivo'
  | 'recuperar_contrasena'
  | 'verificar_correo'
  | 'factura'
  | 'liga_gestion'
  | 'consentimiento';

export interface OutboxMessageInput {
  channel: OutboxChannel;
  recipient: string;
  recipientName?: string;
  template: OutboxTemplate;
  subject?: string;
  body: string;
  bookingId?: string;
  patientId?: string;
  /** Dueño del mensaje (multi-tenant v2). Los mensajes de plataforma (p. ej. recuperación) llevan el userId destinatario. */
  ownerUserId?: string;
}

/**
 * Registra un mensaje saliente en el outbox local.
 * En local los adaptadores (WhatsApp/correo) no envían nada real: el outbox ES
 * la fuente del registro de mensajes que muestra la UI. Cuando se conecte un
 * proveedor real, el adaptador correspondiente lee de aquí y actualiza estados.
 */
export async function writeOutboxMessage(input: OutboxMessageInput): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await getDatabaseAdapter().execute(
    `INSERT INTO outbox_messages
      (id, channel, recipient, recipient_name, template, subject, body, status, booking_id, patient_id, owner_user_id, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'enviado', ?, ?, ?, ?, ?)`,
    [
      id,
      input.channel,
      input.recipient,
      input.recipientName ?? '',
      input.template,
      input.subject ?? '',
      input.body,
      input.bookingId ?? null,
      input.patientId ?? null,
      input.ownerUserId ?? null,
      now,
      now,
    ],
  );
  // Canal listo (CANAL): el outbox es siempre la bitácora in-app; además, si hay un
  // proveedor de correo conectado (RESEND_API_KEY), se intenta el envío REAL. Sin la clave,
  // sendTransactionalEmail es un no-op → comportamiento simulado de hoy. No bloquea ni lanza.
  //
  // El envío real se difiere con afterCommit: si el llamador corre en una transacción del
  // adaptador y hace ROLLBACK, el correo NO sale (no se avisa de una reserva que no se creó).
  // Fuera de una transacción, afterCommit ejecuta de inmediato.
  //
  // NOTA antes de conectar el proveedor: el `body` puede contener PII clínica (nombre del
  // paciente, datos de la sesión, ligas). Al activar RESEND_API_KEY ese contenido sale a un
  // tercero (Resend, EE. UU.); minimiza el cuerpo y/o registra al encargado en el aviso de
  // privacidad (Ley 1581) antes de hacerlo.
  if (input.channel === 'email' && input.recipient.includes('@')) {
    getDatabaseAdapter().afterCommit(() => {
      void sendTransactionalEmail({
        to: input.recipient,
        subject: input.subject ?? '',
        body: input.body,
      }).then(async (result) => {
        if (result.reason && result.reason !== 'sin_proveedor') {
          // El envío REAL falló (proveedor conectado): en vez de 'fallido' definitivo, RE-ENCOLA
          // para reintento durable por el worker (processOutbox, vía /api/jobs/run) con backoff.
          // Un fallo transitorio del proveedor ya no pierde el correo. Dormido (sin_proveedor) no
          // entra aquí. Cierra el hueco de durabilidad de afterCommit en proceso (re-plataforma 0f).
          console.warn(`[correo] envío real falló (outbox ${id}), re-encolado:`, result.reason);
          try {
            await getDatabaseAdapter().execute(
              `UPDATE outbox_messages SET status = 'pendiente', attempts = 1, next_attempt_at = ? WHERE id = ?`,
              [new Date(Date.now() + 60_000).toISOString(), id],
            );
          } catch {
            /* fire-and-forget: nunca propagar */
          }
        }
      });
    });
  }
  return id;
}
