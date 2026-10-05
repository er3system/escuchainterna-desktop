import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Invoice } from '../../domain/Invoice';
import { InvoiceMessageView, InvoiceRepository } from '../../domain/repositories/InvoiceRepository';

interface MessageRow {
  folio: string;
  sent_at: string;
  channel: string | null;
  recipient: string | null;
  subject: string | null;
  body: string | null;
}

/** Facturas acotadas al dueño (owner_user_id) de la sesión. */
export class SqliteInvoiceRepository implements InvoiceRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async nextSequenceForYear(year: number): Promise<number> {
    const rows = await this.db.query<{ folio: string }>(
      `SELECT folio FROM invoices WHERE owner_user_id = ? AND folio LIKE ?`,
      [this.ownerUserId, `EI-${year}-%`],
    );
    let max = 0;
    for (const row of rows) {
      const sequence = Number(row.folio.split('-')[2]);
      if (Number.isFinite(sequence) && sequence > max) max = sequence;
    }
    return max + 1;
  }

  public async save(invoice: Invoice): Promise<void> {
    const primitives = invoice.toPrimitives();
    await this.db.execute(
      `INSERT INTO invoices (id, booking_id, patient_id, owner_user_id, folio, amount, currency, outbox_message_id, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        primitives.id,
        primitives.bookingId,
        primitives.patientId,
        this.ownerUserId,
        primitives.folio,
        primitives.amount,
        primitives.currency,
        primitives.outboxMessageId,
        primitives.sentAt,
      ],
    );
  }

  public async listMessagesForPatient(patientId: string): Promise<InvoiceMessageView[]> {
    const rows = await this.db.query<MessageRow>(
      `SELECT i.folio, i.sent_at, m.channel, m.recipient, m.subject, m.body
         FROM invoices i
         LEFT JOIN outbox_messages m ON m.id = i.outbox_message_id
         WHERE i.patient_id = ? AND i.owner_user_id = ?
         ORDER BY i.sent_at DESC`,
      [patientId, this.ownerUserId],
    );
    return rows.map((row) => ({
      folio: row.folio,
      channel: row.channel ?? 'email',
      recipient: row.recipient ?? '',
      subject: row.subject ?? '',
      body: row.body ?? '',
      sentAt: row.sent_at,
    }));
  }
}
