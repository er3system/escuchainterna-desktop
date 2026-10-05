import type { DatabaseAdapter, SqlParam } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  PaymentsLedger,
  PaymentsLedgerCriteria,
  PaymentsLedgerEntry,
  PaymentsLedgerPage,
} from '../../domain/repositories/PaymentsLedger';
import { groupAmountsByCurrency } from '../../domain/value-objects/currencyTotals';

interface LedgerRow {
  booking_id: string;
  patient_id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  tags_json: string;
  agenda_name: string;
  agenda_color: string;
  start_at: string;
  price: number;
  currency: string;
  fee_charged: number;
  fee_reason: string;
  booking_status: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  invoice_folio: string | null;
  invoice_sent_at: string | null;
}

const BASE_SELECT = `
  SELECT b.id AS booking_id, b.start_at, b.price, b.currency, b.status AS booking_status,
         b.payment_status, b.payment_method, b.paid_at,
         b.fee_charged, b.fee_reason,
         p.id AS patient_id, p.full_name AS patient_name, p.email AS patient_email,
         p.phone AS patient_phone, p.tags_json,
         a.name AS agenda_name, a.color AS agenda_color,
         (SELECT i.folio FROM invoices i WHERE i.booking_id = b.id ORDER BY i.sent_at DESC LIMIT 1) AS invoice_folio,
         (SELECT i.sent_at FROM invoices i WHERE i.booking_id = b.id ORDER BY i.sent_at DESC LIMIT 1) AS invoice_sent_at
  FROM bookings b
  JOIN patients p ON p.id = b.patient_id
  JOIN agendas a ON a.id = b.agenda_id`;

/** Libro de pagos acotado al dueño (owner_user_id) de la sesión. */
export class SqlitePaymentsLedger implements PaymentsLedger {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async search(criteria: PaymentsLedgerCriteria): Promise<PaymentsLedgerPage> {
    const conditions: string[] = ['b.owner_user_id = ?'];
    const params: SqlParam[] = [this.ownerUserId];

    if (criteria.onlyCompleted) {
      // Las sesiones con tarifa (inasistencia/cancelación tardía) también se
      // muestran aunque no estén completadas: la tarifa es un monto por cobrar.
      conditions.push(`(b.status = 'completada' OR b.fee_charged > 0)`);
    }
    if (criteria.paymentStatus) {
      conditions.push('b.payment_status = ?');
      params.push(criteria.paymentStatus);
    }
    if (criteria.patientId) {
      conditions.push('b.patient_id = ?');
      params.push(criteria.patientId);
    }
    if (criteria.fromIso) {
      conditions.push('b.start_at >= ?');
      params.push(criteria.fromIso);
    }
    if (criteria.toIso) {
      conditions.push('b.start_at < ?');
      params.push(criteria.toIso);
    }
    if (criteria.text) {
      conditions.push('(p.full_name LIKE ? OR p.email LIKE ?)');
      const like = `%${criteria.text}%`;
      params.push(like, like);
    }

    const where = ` WHERE ${conditions.join(' AND ')}`;
    const rows = await this.db.query<LedgerRow>(`${BASE_SELECT}${where} ORDER BY b.start_at DESC`, params);

    let entries = rows.map((row) => this.hydrate(row));
    if (criteria.tags && criteria.tags.length > 0) {
      const wanted = criteria.tags.map((tag) => tag.toLocaleLowerCase('es-MX'));
      entries = entries.filter((entry) => {
        const owned = entry.patientTags.map((tag) => tag.toLocaleLowerCase('es-MX'));
        return wanted.some((tag) => owned.includes(tag));
      });
    }

    const collected: Array<{ amount: number; currency: string }> = [];
    const pending: Array<{ amount: number; currency: string }> = [];
    for (const entry of entries) {
      if (entry.paymentStatus === 'pagada') {
        collected.push({ amount: entry.chargeAmount, currency: entry.currency });
      } else if (entry.bookingStatus !== 'cancelada' || entry.feeCharged > 0) {
        pending.push({ amount: entry.chargeAmount, currency: entry.currency });
      }
    }

    return {
      entries,
      collectedByCurrency: groupAmountsByCurrency(collected),
      pendingByCurrency: groupAmountsByCurrency(pending),
    };
  }

  public async findByBookingId(bookingId: string): Promise<PaymentsLedgerEntry | null> {
    const row = await this.db.queryRow<LedgerRow>(`${BASE_SELECT} WHERE b.id = ? AND b.owner_user_id = ?`, [
      bookingId,
      this.ownerUserId,
    ]);
    return row ? this.hydrate(row) : null;
  }

  public async listKnownTags(): Promise<string[]> {
    const rows = await this.db.query<{ tags_json: string }>(
      `SELECT tags_json FROM patients WHERE archived = 0 AND owner_user_id = ?`,
      [this.ownerUserId],
    );
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const row of rows) {
      for (const tag of safeTags(row.tags_json)) {
        const key = tag.toLocaleLowerCase('es-MX');
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
      }
    }
    return tags.sort((a, b) => a.localeCompare(b, 'es-MX'));
  }

  private hydrate(row: LedgerRow): PaymentsLedgerEntry {
    const feeCharged = row.fee_charged ?? 0;
    return {
      bookingId: row.booking_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientEmail: row.patient_email,
      patientPhone: row.patient_phone,
      patientTags: safeTags(row.tags_json),
      agendaName: row.agenda_name,
      agendaColor: row.agenda_color,
      startAt: row.start_at,
      price: row.price,
      currency: row.currency || 'MXN',
      feeCharged,
      feeReason: row.fee_reason ?? '',
      chargeAmount: feeCharged > 0 ? feeCharged : row.price,
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status === 'pagada' ? 'pagada' : 'pendiente',
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
      invoiceFolio: row.invoice_folio,
      invoiceSentAt: row.invoice_sent_at,
    };
  }
}

function safeTags(json: string): string[] {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}
