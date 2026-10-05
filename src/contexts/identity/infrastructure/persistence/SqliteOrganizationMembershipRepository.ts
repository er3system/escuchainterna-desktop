import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { OrganizationMembership, type OrganizationMemberRole } from '../../domain/OrganizationMembership';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';

interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  member_role: string;
  permissions_json: string;
  consultorio_id: string | null;
  created_at: string;
}

function toAggregate(row: MembershipRow): OrganizationMembership {
  return OrganizationMembership.fromPrimitives({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    memberRole: (['master', 'professor', 'psychologist'].includes(row.member_role)
      ? row.member_role
      : 'psychologist') as OrganizationMemberRole,
    permissionsJson: row.permissions_json,
    consultorioId: row.consultorio_id ?? null,
    createdAt: row.created_at,
  });
}

export class SqliteOrganizationMembershipRepository implements OrganizationMembershipRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(membership: OrganizationMembership): Promise<void> {
    const primitives = membership.toPrimitives();
    await this.db.execute(
      `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, consultorio_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(organization_id, user_id) DO UPDATE SET
           member_role = excluded.member_role,
           permissions_json = excluded.permissions_json,
           consultorio_id = excluded.consultorio_id`,
      [
        primitives.id,
        primitives.organizationId,
        primitives.userId,
        primitives.memberRole,
        primitives.permissionsJson,
        primitives.consultorioId,
        primitives.createdAt,
      ],
    );
  }

  public async findByUserId(userId: string): Promise<OrganizationMembership | null> {
    const row = await this.db.queryRow<MembershipRow>(
      'SELECT * FROM organization_memberships WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
      [userId],
    );
    return row ? toAggregate(row) : null;
  }

  public async listByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    const rows = await this.db.query<MembershipRow>(
      'SELECT * FROM organization_memberships WHERE organization_id = ? ORDER BY created_at ASC',
      [organizationId],
    );
    return rows.map(toAggregate);
  }
}
