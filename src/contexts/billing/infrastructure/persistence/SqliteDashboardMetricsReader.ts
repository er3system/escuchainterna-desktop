import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  DashboardMetricsReader,
  DashboardSnapshot,
  GenderShare,
  MethodIncomeShare,
  MonthlyHistoryPoint,
  SessionCountsByStatus,
} from '../../domain/repositories/DashboardMetricsReader';
import { CurrencyAmount, groupAmountsByCurrency } from '../../domain/value-objects/currencyTotals';

/**
 * Monto cobrable de una reserva: la tarifa (inasistencia/cancelación tardía) si la hay,
 * si no el precio. MISMA regla autoritativa del ledger (SqlitePaymentsLedger.chargeAmount);
 * el dashboard usaba SUM(price), que inflaba ingresos y "por cobrar" frente a /pagos.
 */
const CHARGE_AMOUNT_SQL = 'CASE WHEN fee_charged > 0 THEN fee_charged ELSE price END';

/**
 * Conteo de sesiones del mes para el histórico (no canceladas). Antes era un prepared
 * statement izado y reusado en el bucle de 12 meses; con el puerto async (sin prepare)
 * se re-emite el MISMO SQL por iteración.
 */
const HISTORY_SESSIONS_SQL = `SELECT COUNT(*) AS n FROM bookings
   WHERE owner_user_id = ? AND start_at >= ? AND start_at < ? AND status != 'cancelada'`;

/** Ingreso del mes DESGLOSADO por moneda para el histórico (re-emitido por iteración). */
const HISTORY_INCOME_SQL = `SELECT currency, COALESCE(SUM(${CHARGE_AMOUNT_SQL}), 0) AS total FROM bookings
   WHERE owner_user_id = ? AND payment_status = 'pagada' AND paid_at >= ? AND paid_at < ?
   GROUP BY currency`;

/** Métricas del dashboard acotadas al dueño (owner_user_id) de la sesión. */
export class SqliteDashboardMetricsReader implements DashboardMetricsReader {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async snapshotAt(reference: Date): Promise<DashboardSnapshot> {
    const monthStart = startOfMonth(reference);
    const nextMonthStart = addMonths(monthStart, 1);
    const prevMonthStart = subMonths(monthStart, 1);

    const monthStartIso = monthStart.toISOString();
    const nextMonthStartIso = nextMonthStart.toISOString();
    const prevMonthStartIso = prevMonthStart.toISOString();
    const nowIso = reference.toISOString();

    return {
      collectedThisMonth: await this.collectedBetween(monthStartIso, nextMonthStartIso),
      collectedPreviousMonth: await this.collectedBetween(prevMonthStartIso, monthStartIso),
      pendingThisMonth: await this.pendingBetween(monthStartIso, nextMonthStartIso),
      pendingTotal: await this.pendingUntil(nowIso),
      sessions: await this.sessionCountsBetween(monthStartIso, nextMonthStartIso),
      sessionsPreviousMonthTotal: await this.sessionsTotalBetween(prevMonthStartIso, monthStartIso),
      newPatientsThisMonth: await this.newPatientsBetween(monthStartIso, nextMonthStartIso),
      newPatientsPreviousMonth: await this.newPatientsBetween(prevMonthStartIso, monthStartIso),
      genderDistribution: await this.genderDistributionBetween(monthStartIso, nextMonthStartIso),
      incomeByMethod: await this.incomeByMethodBetween(monthStartIso, nextMonthStartIso),
      history: await this.historyEndingAt(monthStart),
      hasAnyBookings: await this.hasAnyBookings(),
    };
  }

  private async collectedBetween(fromIso: string, toIso: string): Promise<CurrencyAmount[]> {
    const rows = await this.db.query<{ currency: string; total: number }>(
      `SELECT currency, COALESCE(SUM(${CHARGE_AMOUNT_SQL}), 0) AS total FROM bookings
         WHERE owner_user_id = ? AND payment_status = 'pagada' AND paid_at >= ? AND paid_at < ?
         GROUP BY currency`,
      [this.ownerUserId, fromIso, toIso],
    );
    return groupAmountsByCurrency(rows.map((row) => ({ amount: row.total, currency: row.currency })));
  }

  private async pendingBetween(fromIso: string, toIso: string): Promise<CurrencyAmount[]> {
    const rows = await this.db.query<{ currency: string; total: number }>(
      `SELECT currency, COALESCE(SUM(${CHARGE_AMOUNT_SQL}), 0) AS total FROM bookings
         WHERE owner_user_id = ? AND payment_status = 'pendiente' AND (status != 'cancelada' OR fee_charged > 0)
           AND start_at >= ? AND start_at < ?
         GROUP BY currency`,
      [this.ownerUserId, fromIso, toIso],
    );
    return groupAmountsByCurrency(rows.map((row) => ({ amount: row.total, currency: row.currency })));
  }

  private async pendingUntil(untilIso: string): Promise<CurrencyAmount[]> {
    const rows = await this.db.query<{ currency: string; total: number }>(
      `SELECT currency, COALESCE(SUM(${CHARGE_AMOUNT_SQL}), 0) AS total FROM bookings
         WHERE owner_user_id = ? AND payment_status = 'pendiente' AND (status != 'cancelada' OR fee_charged > 0) AND start_at <= ?
         GROUP BY currency`,
      [this.ownerUserId, untilIso],
    );
    return groupAmountsByCurrency(rows.map((row) => ({ amount: row.total, currency: row.currency })));
  }

  private async sessionCountsBetween(fromIso: string, toIso: string): Promise<SessionCountsByStatus> {
    const rows = await this.db.query<{ status: string; n: number }>(
      `SELECT status, COUNT(*) AS n FROM bookings
         WHERE owner_user_id = ? AND start_at >= ? AND start_at < ? GROUP BY status`,
      [this.ownerUserId, fromIso, toIso],
    );
    const byStatus = new Map(rows.map((row) => [row.status, row.n]));

    const rescheduled = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM bookings
         WHERE owner_user_id = ? AND start_at >= ? AND start_at < ? AND reschedule_count > 0`,
      [this.ownerUserId, fromIso, toIso],
    );

    const completed = byStatus.get('completada') ?? 0;
    const confirmed = byStatus.get('confirmada') ?? 0;
    const scheduled = byStatus.get('agendada') ?? 0;
    const cancelled = byStatus.get('cancelada') ?? 0;
    const noShow = byStatus.get('inasistencia') ?? 0;

    return {
      total: completed + confirmed + scheduled + cancelled + noShow,
      completed,
      confirmed,
      scheduled,
      cancelled,
      noShow,
      rescheduled: rescheduled?.n ?? 0,
    };
  }

  private async sessionsTotalBetween(fromIso: string, toIso: string): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM bookings WHERE owner_user_id = ? AND start_at >= ? AND start_at < ?`,
      [this.ownerUserId, fromIso, toIso],
    );
    return row?.n ?? 0;
  }

  private async newPatientsBetween(fromIso: string, toIso: string): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM patients WHERE owner_user_id = ? AND created_at >= ? AND created_at < ?`,
      [this.ownerUserId, fromIso, toIso],
    );
    return row?.n ?? 0;
  }

  private async genderDistributionBetween(fromIso: string, toIso: string): Promise<GenderShare[]> {
    const rows = await this.db.query<{ gender: string; n: number }>(
      `SELECT p.gender AS gender, COUNT(DISTINCT p.id) AS n
         FROM patients p
         JOIN bookings b ON b.patient_id = p.id
         WHERE b.owner_user_id = ? AND b.start_at >= ? AND b.start_at < ?
         GROUP BY p.gender ORDER BY n DESC`,
      [this.ownerUserId, fromIso, toIso],
    );
    const total = rows.reduce((sum, row) => sum + row.n, 0);
    return rows.map((row) => ({
      gender: row.gender || 'sin especificar',
      count: row.n,
      percentage: total > 0 ? (row.n / total) * 100 : 0,
    }));
  }

  private async incomeByMethodBetween(fromIso: string, toIso: string): Promise<MethodIncomeShare[]> {
    const rows = await this.db.query<{ method: string; currency: string; total: number }>(
      `SELECT COALESCE(payment_method, 'otro') AS method, currency, COALESCE(SUM(${CHARGE_AMOUNT_SQL}), 0) AS total
         FROM bookings
         WHERE owner_user_id = ? AND payment_status = 'pagada' AND paid_at >= ? AND paid_at < ?
         GROUP BY payment_method, currency ORDER BY total DESC`,
      [this.ownerUserId, fromIso, toIso],
    );
    // El porcentaje se calcula DENTRO de cada moneda: mezclar monedas en un % no significa nada.
    const totalsByCurrency = new Map<string, number>();
    for (const row of rows) {
      totalsByCurrency.set(row.currency, (totalsByCurrency.get(row.currency) ?? 0) + row.total);
    }
    return rows.map((row) => {
      const currencyTotal = totalsByCurrency.get(row.currency) ?? 0;
      return {
        method: row.method,
        currency: row.currency || 'MXN',
        amount: row.total,
        percentage: currencyTotal > 0 ? (row.total / currencyTotal) * 100 : 0,
      };
    });
  }

  private async historyEndingAt(currentMonthStart: Date): Promise<MonthlyHistoryPoint[]> {
    const points: MonthlyHistoryPoint[] = [];
    // Re-emite el SQL por iteración (12 vueltas): el puerto async no tiene prepare, así que
    // en vez de izar dos prepared statements y reusarlos, se vuelve a consultar con los mismos
    // SQL constantes (HISTORY_SESSIONS_SQL / HISTORY_INCOME_SQL) en cada mes. Cálculo idéntico.
    for (let offset = 11; offset >= 0; offset -= 1) {
      const bucketStart = subMonths(currentMonthStart, offset);
      const bucketEnd = addMonths(bucketStart, 1);
      const fromIso = bucketStart.toISOString();
      const toIso = bucketEnd.toISOString();
      const sessions = await this.db.queryRow<{ n: number }>(HISTORY_SESSIONS_SQL, [
        this.ownerUserId,
        fromIso,
        toIso,
      ]);
      const incomeRows = await this.db.query<{ currency: string; total: number }>(HISTORY_INCOME_SQL, [
        this.ownerUserId,
        fromIso,
        toIso,
      ]);
      const incomeByCurrency: Record<string, number> = {};
      for (const row of incomeRows) {
        if (row.total > 0) {
          const code = row.currency || 'MXN';
          incomeByCurrency[code] = (incomeByCurrency[code] ?? 0) + row.total;
        }
      }
      points.push({
        month: format(bucketStart, 'yyyy-MM'),
        sessions: sessions?.n ?? 0,
        incomeByCurrency,
      });
    }
    return points;
  }

  private async hasAnyBookings(): Promise<boolean> {
    const row = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM bookings WHERE owner_user_id = ?',
      [this.ownerUserId],
    );
    return (row?.n ?? 0) > 0;
  }
}
