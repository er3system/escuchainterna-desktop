import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { outboxTemplateLabel } from '@/contexts/marketing/domain/value-objects/OutboxTemplateLabel';
import type { BookingMessage } from './agendaTypes';

/**
 * Lectura del outbox filtrada por reservación (modal «Ver mensajes»).
 * Nota de arquitectura: el outbox es infraestructura compartida y su registro
 * general ya lo sirve el contexto marketing (GetMessageLog), que no filtra por
 * reservación. Este helper de solo lectura vive aquí —mismo patrón que
 * configuracion/integraciones/integrationConnections.ts— para no invadir
 * archivos de otros contextos.
 */

interface OutboxRow {
  id: string;
  channel: 'whatsapp' | 'email';
  template: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
}

export async function listMessagesForBooking(
  bookingId: string,
  ownerUserId: string,
): Promise<BookingMessage[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT id, channel, template, subject, body, status, created_at
       FROM outbox_messages
       WHERE booking_id = ? AND owner_user_id = ?
       ORDER BY created_at DESC, channel ASC`,
    [bookingId, ownerUserId],
  )) as unknown as OutboxRow[];
  return rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    template: row.template,
    templateLabel: outboxTemplateLabel(row.template),
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  }));
}
