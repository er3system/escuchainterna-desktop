import type { DatabaseAdapter, SqlParam } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  AdminDashboard,
  AdminDashboardReader,
  RegistrationsPoint,
} from '../../domain/repositories/AdminDashboardReader';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_AUDIT_LIMIT = 8;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Dashboard de /admin con agregados SQL (counts/sums) sobre toda la
 * plataforma. Por privacidad NUNCA lee contenido clínico: solo números.
 */
export class SqliteAdminDashboardReader implements AdminDashboardReader {
  public constructor(
    private readonly audit: AdminAuditLogRepository,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  private async count(sql: string, params: SqlParam[] = []): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(sql, params);
    return row?.n ?? 0;
  }

  public async read(now: Date = new Date()): Promise<AdminDashboard> {
    const nowIso = now.toISOString();
    const inSevenDaysIso = new Date(now.getTime() + 7 * DAY_MS).toISOString();

    const totalUsers = await this.count('SELECT COUNT(*) AS n FROM users');
    const suspendedUsers = await this.count(`SELECT COUNT(*) AS n FROM users WHERE status = 'suspendido'`);

    const trialsActive = await this.count(
      `SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'trial' AND trial_ends_at > ?`,
      [nowIso],
    );
    const trialsExpiringSoon = await this.count(
      `SELECT COUNT(*) AS n FROM subscriptions
        WHERE status = 'trial' AND trial_ends_at > ? AND trial_ends_at <= ?`,
      [nowIso, inSevenDaysIso],
    );

    const activeSubscriptions = await this.count(`SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'activa'`);

    return {
      users: {
        total: totalUsers,
        active: totalUsers - suspendedUsers,
        suspended: suspendedUsers,
      },
      trials: { active: trialsActive, expiringSoon: trialsExpiringSoon },
      subscriptions: {
        active: activeSubscriptions,
        // MRR aproximado en COP (moneda del producto): suscripciones activas ×
        // precio de lista COP del plan profesional. Es una estimación de display.
        mrr: activeSubscriptions * (await this.proPlanCopPrice()),
      },
      organizations: await this.count('SELECT COUNT(*) AS n FROM organizations'),
      totals: {
        patients: await this.count('SELECT COUNT(*) AS n FROM patients'),
        bookings: await this.count('SELECT COUNT(*) AS n FROM bookings'),
        outboxMessages: await this.count('SELECT COUNT(*) AS n FROM outbox_messages'),
      },
      registrationsLast30Days: await this.registrationsLast30Days(now),
      databaseSizeBytes: await this.databaseSizeBytes(),
      recentAuditEntries: await this.audit.search({ limit: RECENT_AUDIT_LIMIT }),
    };
  }

  /** Serie completa de 30 días (incluye días en cero) de altas de usuarios. */
  private async registrationsLast30Days(now: Date): Promise<RegistrationsPoint[]> {
    const start = new Date(now.getTime() - 29 * DAY_MS);
    const rows = await this.db.query<{ day: string; n: number }>(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n
           FROM users
          WHERE substr(created_at, 1, 10) >= ?
          GROUP BY substr(created_at, 1, 10)`,
      [dayKey(start)],
    );

    const byDay = new Map(rows.map((row) => [row.day, row.n]));
    const series: RegistrationsPoint[] = [];
    for (let i = 0; i < 30; i += 1) {
      const day = dayKey(new Date(start.getTime() + i * DAY_MS));
      series.push({ day, count: byDay.get(day) ?? 0 });
    }
    return series;
  }

  /** Precio de lista COP del plan profesional (fallback 149.000 si falta). */
  private async proPlanCopPrice(): Promise<number> {
    const row = await this.db.queryRow<{ prices_json: string }>(
      `SELECT prices_json FROM plans WHERE id = 'profesional'`,
    );
    try {
      const prices = JSON.parse(row?.prices_json ?? '{}') as Record<string, number>;
      return typeof prices.COP === 'number' ? prices.COP : 149_000;
    } catch {
      return 149_000;
    }
  }

  private async databaseSizeBytes(): Promise<number> {
    // El tamaño de la BD es específico del motor: en Postgres `pg_database_size`,
    // en SQLite `PRAGMA page_count * page_size`. Se ramifica por el MISMO selector
    // que getDatabaseAdapter (DATABASE_URL presente ⇒ Postgres) — PRAGMA lanza un
    // error de sintaxis en Postgres y rompía todo el dashboard de /admin.
    if (process.env.DATABASE_URL) {
      const row = await this.db.queryRow<{ bytes: number }>(
        'SELECT pg_database_size(current_database()) AS bytes',
      );
      return row ? Number(row.bytes) : 0;
    }
    const pageCount = (await this.db.queryRow<{ page_count: number }>('PRAGMA page_count'))?.page_count ?? 0;
    const pageSize = (await this.db.queryRow<{ page_size: number }>('PRAGMA page_size'))?.page_size ?? 0;
    return pageCount * pageSize;
  }
}
