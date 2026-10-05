import type { UserRole } from '../value-objects/UserRole';

/**
 * Read models del directorio de administración: cuentas, organizaciones y
 * miembros. Solo datos de identidad/suscripción — nada clínico.
 */

export interface AdminAccountRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'activo' | 'suspendido';
  organizationId: string | null;
  organizationName: string | null;
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  /** Gasto estimado de IA del mes calendario en curso (COP). */
  aiSpentCop: number;
  /** Bytes de adjuntos del dueño. */
  storageUsedBytes: number;
  /** Cuota de almacenamiento efectiva en bytes; null = sin límite (admin). */
  storageLimitBytes: number | null;
  /** Overrides de topes por cuenta (null = usar el plan). Para prefilar el editor. */
  overrides: {
    aiMonthlyBudgetCop: number | null;
    aiSoftBudgetCop: number | null;
    waMonthlyLimit: number | null;
    storageLimitGb: number | null;
  };
}

export interface AdminOrganizationRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logoPath: string | null;
  masterUserId: string | null;
  masterEmail: string | null;
  masterName: string | null;
  defaultMemberPoliciesJson: string;
  memberCount: number;
  createdAt: string;
}

export interface AdminOrgMemberRow {
  userId: string;
  email: string;
  fullName: string;
  memberRole: string;
  permissionsJson: string;
  status: 'activo' | 'suspendido';
}

export interface AdminUserOption {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AdminDirectoryReader {
  listAccounts(): Promise<AdminAccountRow[]>;
  listOrganizations(): Promise<AdminOrganizationRow[]>;
  findOrganization(organizationId: string): Promise<AdminOrganizationRow | null>;
  listOrganizationMembers(organizationId: string): Promise<AdminOrgMemberRow[]>;
  /** Usuarios candidatos a maestro de organización (rol org_master). */
  listMasterCandidates(): Promise<AdminUserOption[]>;
}
