import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Lecturas agregadas de gasto de IA para el dashboard de administración.
 * Solo agregados (gasto y conteos) — nunca contenido clínico ni prompts.
 */

export interface AiTopSpender {
  email: string;
  spentCop: number;
  events: number;
}

export interface AiMonthSpendSummary {
  totalCop: number;
  totalUsd: number;
  events: number;
  topUsers: AiTopSpender[];
}

export async function getAiMonthSpend(now: Date = new Date()): Promise<AiMonthSpendSummary> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const db = getDatabaseAdapter();

  const totals = (await db.queryRow<{ total_cop: number; total_usd: number; events: number }>(
    `SELECT COALESCE(SUM(est_cost_cop), 0) AS total_cop,
              COALESCE(SUM(est_cost_usd), 0) AS total_usd,
              COUNT(*) AS events
         FROM ai_usage_events
        WHERE created_at >= ? AND created_at < ?`,
    [start, end],
  )) as { total_cop: number; total_usd: number; events: number };

  const topRows = await db.query<{ email: string; spent_cop: number; events: number }>(
    `SELECT COALESCE(u.email, e.owner_user_id) AS email,
              SUM(e.est_cost_cop) AS spent_cop,
              COUNT(*) AS events
         FROM ai_usage_events e
         LEFT JOIN users u ON u.id = e.owner_user_id
        WHERE e.created_at >= ? AND e.created_at < ?
        -- u.email va en el SELECT (dentro del COALESCE): Postgres exige agruparla
        -- también, no solo por owner_user_id. Como el JOIN es 1:1 por la PK u.id,
        -- agrupar por (owner_user_id, u.email) da el mismo resultado y porta a ambos.
        GROUP BY e.owner_user_id, u.email
        ORDER BY spent_cop DESC
        LIMIT 5`,
    [start, end],
  );

  return {
    totalCop: Number(totals.total_cop),
    totalUsd: Number(totals.total_usd),
    events: Number(totals.events),
    topUsers: topRows.map((row) => ({
      email: row.email,
      spentCop: Number(row.spent_cop),
      events: Number(row.events),
    })),
  };
}
