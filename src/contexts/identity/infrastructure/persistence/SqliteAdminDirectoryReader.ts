import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { BYTES_PER_GB, DEFAULT_STORAGE_LIMIT_GB } from '@/shared/infrastructure/storage-billing/StorageQuotaGate';
import { isUserRole, type UserRole } from '../../domain/value-objects/UserRole';
import type {
  AdminAccountRow,
  AdminDirectoryReader,
  AdminOrganizationRow,
  AdminOrgMemberRow,
  AdminUserOption,
} from '../../domain/repositories/AdminDirectoryReader';

interface AccountExtras {
  aiSpentCop: number;
  storageUsedBytes: number;
  storageLimitBytes: number | null;
  overrides: AdminAccountRow['overrides'];
}

interface AccountSqlRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  org_id: string | null;
  org_name: string | null;
  plan: string | null;
  sub_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface OrganizationSqlRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logo_path: string | null;
  master_user_id: string | null;
  master_email: string | null;
  master_name: string | null;
  default_member_policies_json: string;
  member_count: number;
  created_at: string;
}

interface MemberSqlRow {
  user_id: string;
  email: string;
  full_name: string;
  member_role: string;
  permissions_json: string;
  status: string;
}

function toRole(raw: string): UserRole {
  return isUserRole(raw) ? raw : 'psychologist';
}

function toStatus(raw: string): 'activo' | 'suspendido' {
  return raw === 'suspendido' ? 'suspendido' : 'activo';
}

function toAccount(row: AccountSqlRow, extras: AccountExtras): AdminAccountRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: toRole(row.role),
    status: toStatus(row.status),
    organizationId: row.org_id,
    organizationName: row.org_name,
    plan: row.plan,
    subscriptionStatus: row.sub_status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    aiSpentCop: extras.aiSpentCop,
    storageUsedBytes: extras.storageUsedBytes,
    storageLimitBytes: extras.storageLimitBytes,
    overrides: extras.overrides,
  };
}

function toOrganization(row: OrganizationSqlRow): AdminOrganizationRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    logoPath: row.logo_path,
    masterUserId: row.master_user_id,
    masterEmail: row.master_email,
    masterName: row.master_name,
    defaultMemberPoliciesJson: row.default_member_policies_json,
    memberCount: row.member_count,
    createdAt: row.created_at,
  };
}

const ORGANIZATION_SELECT = `
  SELECT o.id, o.name, o.slug, o.kind, o.logo_path, o.master_user_id,
         mu.email AS master_email,
         COALESCE(mp.full_name, '') AS master_name,
         o.default_member_policies_json,
         (SELECT COUNT(*) FROM organization_memberships m WHERE m.organization_id = o.id) AS member_count,
         o.created_at
    FROM organizations o
    LEFT JOIN users mu ON mu.id = o.master_user_id
    LEFT JOIN practitioner_profile mp ON mp.user_id = o.master_user_id`;

/** Directorio del hub de administración: identidad + suscripción, nada clínico. */
export class SqliteAdminDirectoryReader implements AdminDirectoryReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async listAccounts(): Promise<AdminAccountRow[]> {
    const rows = await this.db.query<AccountSqlRow>(
      `SELECT u.id, u.email,
                COALESCE(p.full_name, '') AS full_name,
                u.role, u.status,
                o.id AS org_id, o.name AS org_name,
                s.plan, s.status AS sub_status, s.trial_ends_at, s.current_period_end,
                u.created_at
           FROM users u
           LEFT JOIN practitioner_profile p ON p.user_id = u.id
           -- El GROUP BY u.id existía SOLO para colapsar las filas que multiplica
           -- un usuario con >1 membresía de org. Postgres rechaza (42803) las
           -- columnas de tablas UNIDAS (o.*, s.*, p.*) que no dependen de u.id.
           -- En vez de agrupar, se deduplica la membresía en una subconsulta
           -- (una org por usuario); profile y subscription son 1:1 y no multiplican.
           LEFT JOIN (
                 SELECT m1.user_id, MIN(m1.organization_id) AS organization_id
                   FROM organization_memberships m1
                  GROUP BY m1.user_id
               ) m ON m.user_id = u.id
           LEFT JOIN organizations o ON o.id = m.organization_id
           LEFT JOIN subscriptions s ON s.user_id = u.id
          ORDER BY u.created_at DESC`,
    );

    // Uso por usuario, en LOTE (evita N consultas): gasto IA del mes calendario
    // en curso y bytes de adjuntos. Más overrides y cuota de almacenamiento del plan.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

    const aiMap = new Map<string, number>();
    for (const r of await this.db.query<{ uid: string; cop: number }>(
      `SELECT owner_user_id AS uid, COALESCE(SUM(est_cost_cop), 0) AS cop
           FROM ai_usage_events WHERE created_at >= ? AND created_at < ? GROUP BY owner_user_id`,
      [monthStart, monthEnd],
    )) {
      aiMap.set(r.uid, Number(r.cop));
    }

    const storageMap = new Map<string, number>();
    for (const r of await this.db.query<{ uid: string; bytes: number }>(
      `SELECT owner_user_id AS uid, COALESCE(SUM(size), 0) AS bytes FROM patient_files GROUP BY owner_user_id`,
    )) {
      storageMap.set(r.uid, Number(r.bytes));
    }

    const overrideMap = new Map<string, AdminAccountRow['overrides']>();
    for (const r of await this.db.query<{
      user_id: string;
      ai_monthly_budget_cop: number | null;
      ai_soft_budget_cop: number | null;
      wa_monthly_limit: number | null;
      storage_limit_gb: number | null;
    }>(
      `SELECT user_id, ai_monthly_budget_cop, ai_soft_budget_cop, wa_monthly_limit, storage_limit_gb
           FROM user_limit_overrides`,
    )) {
      overrideMap.set(r.user_id, {
        aiMonthlyBudgetCop: r.ai_monthly_budget_cop,
        aiSoftBudgetCop: r.ai_soft_budget_cop,
        waMonthlyLimit: r.wa_monthly_limit,
        storageLimitGb: r.storage_limit_gb,
      });
    }

    const planStorageGb = new Map<string, number | null>();
    for (const r of await this.db.query<{
      id: string;
      storage_limit_gb: number | null;
    }>(`SELECT id, storage_limit_gb FROM plans`)) {
      planStorageGb.set(r.id, r.storage_limit_gb);
    }

    const emptyOverrides: AdminAccountRow['overrides'] = {
      aiMonthlyBudgetCop: null,
      aiSoftBudgetCop: null,
      waMonthlyLimit: null,
      storageLimitGb: null,
    };

    return rows.map((row) => {
      const overrides = overrideMap.get(row.id) ?? { ...emptyOverrides };
      let storageLimitBytes: number | null;
      if (toRole(row.role) === 'admin') {
        storageLimitBytes = null; // admin sin límite
      } else {
        const planGb = (row.plan ? planStorageGb.get(row.plan) : null) ?? DEFAULT_STORAGE_LIMIT_GB;
        const gb = overrides.storageLimitGb ?? planGb;
        storageLimitBytes = gb * BYTES_PER_GB;
      }
      return toAccount(row, {
        aiSpentCop: aiMap.get(row.id) ?? 0,
        storageUsedBytes: storageMap.get(row.id) ?? 0,
        storageLimitBytes,
        overrides,
      });
    });
  }

  public async listOrganizations(): Promise<AdminOrganizationRow[]> {
    const rows = await this.db.query<OrganizationSqlRow>(`${ORGANIZATION_SELECT} ORDER BY o.created_at DESC`);
    return rows.map(toOrganization);
  }

  public async findOrganization(organizationId: string): Promise<AdminOrganizationRow | null> {
    const row = await this.db.queryRow<OrganizationSqlRow>(`${ORGANIZATION_SELECT} WHERE o.id = ?`, [
      organizationId,
    ]);
    return row ? toOrganization(row) : null;
  }

  public async listOrganizationMembers(organizationId: string): Promise<AdminOrgMemberRow[]> {
    const rows = await this.db.query<MemberSqlRow>(
      `SELECT m.user_id, u.email,
                COALESCE(p.full_name, '') AS full_name,
                m.member_role, m.permissions_json, u.status
           FROM organization_memberships m
           JOIN users u ON u.id = m.user_id
           LEFT JOIN practitioner_profile p ON p.user_id = u.id
          WHERE m.organization_id = ?
          ORDER BY m.created_at ASC`,
      [organizationId],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      memberRole: row.member_role,
      permissionsJson: row.permissions_json,
      status: toStatus(row.status),
    }));
  }

  public async listMasterCandidates(): Promise<AdminUserOption[]> {
    const rows = await this.db.query<{ id: string; email: string; full_name: string; role: string }>(
      `SELECT u.id, u.email, COALESCE(p.full_name, '') AS full_name, u.role
           FROM users u
           LEFT JOIN practitioner_profile p ON p.user_id = u.id
          WHERE u.role = 'org_master'
          ORDER BY full_name ASC, u.email ASC`,
    );
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: toRole(row.role),
    }));
  }
}
