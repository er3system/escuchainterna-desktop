import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  OrganizationInsights,
  OrganizationInsightsReader,
  OrgActivityPoint,
  OrgIncomeByCurrency,
  OrgMemberSessionsPoint,
  OrgSessionStatusBreakdown,
  OrgSupervisionActivityPoint,
} from '../../domain/repositories/OrganizationInsightsReader';

/** Mes AAAA-MM de una fecha, desplazado `delta` meses (en hora local). */
function monthKey(now: Date, delta = 0): string {
  const date = new Date(now.getFullYear(), now.getMonth() + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface MemberIdRow {
  user_id: string;
  status: string;
  created_at: string;
}

/**
 * Panel de organización con agregados SQL (counts/sums) del equipo.
 * Por privacidad NUNCA lee contenido clínico: solo números y nombres de
 * los propios miembros. Filas sqlite → objetos planos serializables.
 */
export class SqliteOrganizationInsightsReader implements OrganizationInsightsReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async read(organizationId: string, now: Date = new Date()): Promise<OrganizationInsights> {
    const month = monthKey(now);
    const previousMonth = monthKey(now, -1);
    const monthStart = `${month}-01`;

    const members = await this.db.query<MemberIdRow>(
      `SELECT m.user_id, u.status, m.created_at
           FROM organization_memberships m
           JOIN users u ON u.id = m.user_id
          WHERE m.organization_id = ?`,
      [organizationId],
    );

    const empty: OrganizationInsights = {
      month,
      activeMembers: { current: 0, previous: 0 },
      teamPatients: { current: 0, previous: 0 },
      sessionsHeld: { current: 0, previous: 0 },
      attendanceRate: { current: null, previous: null },
      consentRate: { current: null, previous: null },
      patientsWithConsent: 0,
      incomeByCurrency: [],
      activityLast12Months: this.emptyMonths(now).map((m) => ({ month: m, sessions: 0, completed: 0 })),
      sessionsByMember: [],
      sessionStatus: { completadas: 0, agendadas: 0, canceladas: 0, inasistencias: 0 },
      supervisionActivity: this.emptyMonths(now).map((m) => ({
        month: m,
        notesWritten: 0,
        notesReviewed: 0,
      })),
    };
    if (members.length === 0) return empty;

    const ids = members.map((member) => member.user_id);
    const marks = ids.map(() => '?').join(', ');

    // Miembros activos: el "mes anterior" se aproxima por fecha de alta de la
    // membresía (no hay historial de estatus) — suficiente para la tendencia.
    const active = members.filter((member) => member.status !== 'suspendido');
    empty.activeMembers = {
      current: active.length,
      previous: active.filter((member) => member.created_at < monthStart).length,
    };

    empty.teamPatients = await this.teamPatients(ids, marks, monthStart);
    const attendance = await this.attendance(ids, marks, month, previousMonth);
    empty.sessionsHeld = { current: attendance.current.completadas, previous: attendance.previous.completadas };
    empty.attendanceRate = {
      current: rate(attendance.current.completadas, attendance.current.inasistencias),
      previous: rate(attendance.previous.completadas, attendance.previous.inasistencias),
    };

    const consent = await this.consent(ids, marks, monthStart, empty.teamPatients);
    empty.consentRate = consent.rate;
    empty.patientsWithConsent = consent.patientsWithConsent;

    empty.incomeByCurrency = await this.incomeByCurrency(ids, marks, month, previousMonth);
    empty.activityLast12Months = await this.activityLast12Months(ids, marks, now);
    empty.sessionsByMember = await this.sessionsByMember(ids, marks, month);
    empty.sessionStatus = await this.sessionStatus(ids, marks, month);
    empty.supervisionActivity = await this.supervisionActivity(ids, marks, now);
    return empty;
  }

  /** Últimos 12 meses (incluido el actual), del más antiguo al más reciente. */
  private emptyMonths(now: Date): string[] {
    const months: string[] = [];
    for (let i = 11; i >= 0; i -= 1) months.push(monthKey(now, -i));
    return months;
  }

  private async teamPatients(ids: string[], marks: string, monthStart: string) {
    const row = (await this.db.queryRow<{ total: number; previous: number | null }>(
      `SELECT COUNT(*) AS total,
                SUM(CASE WHEN created_at < ? THEN 1 ELSE 0 END) AS previous
           FROM patients
          WHERE owner_user_id IN (${marks}) AND archived = 0`,
      [monthStart, ...ids],
    ))!;
    return { current: row.total, previous: row.previous ?? 0 };
  }

  private async attendance(ids: string[], marks: string, month: string, previousMonth: string) {
    const read = async (target: string) =>
      (await this.db.queryRow<{ completadas: number | null; inasistencias: number | null }>(
        `SELECT SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END) AS completadas,
                  SUM(CASE WHEN status = 'inasistencia' THEN 1 ELSE 0 END) AS inasistencias
             FROM bookings
            WHERE owner_user_id IN (${marks}) AND substr(start_at, 1, 7) = ?`,
        [...ids, target],
      ))!;
    const current = await read(month);
    const previous = await read(previousMonth);
    return {
      current: { completadas: current.completadas ?? 0, inasistencias: current.inasistencias ?? 0 },
      previous: { completadas: previous.completadas ?? 0, inasistencias: previous.inasistencias ?? 0 },
    };
  }

  private async consent(
    ids: string[],
    marks: string,
    monthStart: string,
    patients: { current: number; previous: number },
  ) {
    const row = (await this.db.queryRow<{ signed: number; signed_previous: number | null }>(
      `SELECT COUNT(DISTINCT c.patient_id) AS signed,
                COUNT(DISTINCT CASE WHEN c.signed_at IS NOT NULL AND c.signed_at < ?
                                    THEN c.patient_id END) AS signed_previous
           FROM patient_consents c
           JOIN patients p ON p.id = c.patient_id AND p.archived = 0
          WHERE c.owner_user_id IN (${marks})
            AND c.status IN ('firmado', 'papel_adjunto')`,
      [monthStart, ...ids],
    ))!;
    return {
      patientsWithConsent: row.signed,
      rate: {
        current: patients.current > 0 ? (row.signed * 100) / patients.current : null,
        previous: patients.previous > 0 ? ((row.signed_previous ?? 0) * 100) / patients.previous : null,
      },
    };
  }

  private async incomeByCurrency(
    ids: string[],
    marks: string,
    month: string,
    previousMonth: string,
  ): Promise<OrgIncomeByCurrency[]> {
    // Mes del COBRO (paid_at); las filas históricas sin él usan la fecha de la sesión.
    const rows = await this.db.query<{
      currency: string;
      period: string;
      total: number;
    }>(
      `SELECT COALESCE(NULLIF(currency, ''), 'MXN') AS currency,
                substr(COALESCE(paid_at, start_at), 1, 7) AS period,
                COALESCE(SUM(price), 0) AS total
           FROM bookings
          WHERE owner_user_id IN (${marks})
            AND payment_status = 'pagada'
            AND substr(COALESCE(paid_at, start_at), 1, 7) IN (?, ?)
          GROUP BY currency, period`,
      [...ids, month, previousMonth],
    );

    const byCurrency = new Map<string, OrgIncomeByCurrency>();
    for (const row of rows) {
      const entry = byCurrency.get(row.currency) ?? { currency: row.currency, current: 0, previous: 0 };
      if (row.period === month) entry.current = row.total;
      else entry.previous = row.total;
      byCurrency.set(row.currency, entry);
    }
    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private async activityLast12Months(ids: string[], marks: string, now: Date): Promise<OrgActivityPoint[]> {
    const months = this.emptyMonths(now);
    const rows = await this.db.query<{
      month: string;
      sessions: number | null;
      completed: number | null;
    }>(
      `SELECT substr(start_at, 1, 7) AS month,
                SUM(CASE WHEN status != 'cancelada' THEN 1 ELSE 0 END) AS sessions,
                SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END) AS completed
           FROM bookings
          WHERE owner_user_id IN (${marks}) AND substr(start_at, 1, 7) >= ?
          GROUP BY substr(start_at, 1, 7)`,
      [...ids, months[0]],
    );
    const byMonth = new Map(rows.map((row) => [row.month, row]));
    return months.map((month) => ({
      month,
      sessions: byMonth.get(month)?.sessions ?? 0,
      completed: byMonth.get(month)?.completed ?? 0,
    }));
  }

  private async sessionsByMember(ids: string[], marks: string, month: string): Promise<OrgMemberSessionsPoint[]> {
    const rows = await this.db.query<{ member_name: string; sessions: number }>(
      `SELECT COALESCE(NULLIF(p.full_name, ''), u.email) AS member_name,
                COUNT(b.id) AS sessions
           FROM bookings b
           JOIN users u ON u.id = b.owner_user_id
           LEFT JOIN practitioner_profile p ON p.user_id = b.owner_user_id
          WHERE b.owner_user_id IN (${marks})
            AND substr(b.start_at, 1, 7) = ?
            AND b.status != 'cancelada'
          -- p.full_name / u.email van en el SELECT desde tablas UNIDAS: Postgres
          -- exige agruparlas también (no bastan por owner_user_id). Como el JOIN
          -- es 1:1, agrupar por las tres da el mismo resultado y porta a ambos.
          GROUP BY b.owner_user_id, p.full_name, u.email
          ORDER BY sessions DESC, member_name ASC`,
      [...ids, month],
    );
    return rows.map((row) => ({ memberName: row.member_name, sessions: row.sessions }));
  }

  private async sessionStatus(ids: string[], marks: string, month: string): Promise<OrgSessionStatusBreakdown> {
    const row = (await this.db.queryRow<{
      completadas: number | null;
      agendadas: number | null;
      canceladas: number | null;
      inasistencias: number | null;
    }>(
      `SELECT SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END) AS completadas,
                SUM(CASE WHEN status IN ('agendada', 'confirmada') THEN 1 ELSE 0 END) AS agendadas,
                SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
                SUM(CASE WHEN status = 'inasistencia' THEN 1 ELSE 0 END) AS inasistencias
           FROM bookings
          WHERE owner_user_id IN (${marks}) AND substr(start_at, 1, 7) = ?`,
      [...ids, month],
    ))!;
    return {
      completadas: row.completadas ?? 0,
      agendadas: row.agendadas ?? 0,
      canceladas: row.canceladas ?? 0,
      inasistencias: row.inasistencias ?? 0,
    };
  }

  private async supervisionActivity(
    ids: string[],
    marks: string,
    now: Date,
  ): Promise<OrgSupervisionActivityPoint[]> {
    const months = this.emptyMonths(now);
    const written = await this.db.query<{ month: string; n: number }>(
      `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS n
           FROM session_notes
          WHERE owner_user_id IN (${marks}) AND substr(created_at, 1, 7) >= ?
          GROUP BY substr(created_at, 1, 7)`,
      [...ids, months[0]],
    );
    const reviewed = await this.db.query<{ month: string; n: number }>(
      `SELECT substr(updated_at, 1, 7) AS month, COUNT(*) AS n
           FROM supervision_session_reviews
          WHERE supervised_user_id IN (${marks}) AND reviewed = 1
            AND substr(updated_at, 1, 7) >= ?
          GROUP BY substr(updated_at, 1, 7)`,
      [...ids, months[0]],
    );

    const writtenByMonth = new Map(written.map((row) => [row.month, row.n]));
    const reviewedByMonth = new Map(reviewed.map((row) => [row.month, row.n]));
    return months.map((month) => ({
      month,
      notesWritten: writtenByMonth.get(month) ?? 0,
      notesReviewed: reviewedByMonth.get(month) ?? 0,
    }));
  }
}

/** % de asistencia 0–100; null si el mes no tuvo sesiones concluidas. */
function rate(completadas: number, inasistencias: number): number | null {
  const total = completadas + inasistencias;
  return total > 0 ? (completadas * 100) / total : null;
}
