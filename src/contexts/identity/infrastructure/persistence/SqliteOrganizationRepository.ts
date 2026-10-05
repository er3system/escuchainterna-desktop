import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Organization, type OrganizationKind } from '../../domain/Organization';
import type { OrganizationRepository } from '../../domain/repositories/OrganizationRepository';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logo_path: string | null;
  master_user_id: string | null;
  default_member_policies_json: string;
  free_service: number;
  created_at: string;
}

function toAggregate(row: OrganizationRow): Organization {
  return Organization.fromPrimitives({
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: (['empresa', 'universidad', 'clinica'].includes(row.kind) ? row.kind : 'empresa') as OrganizationKind,
    logoPath: row.logo_path,
    masterUserId: row.master_user_id,
    defaultMemberPoliciesJson: row.default_member_policies_json,
    freeService: row.free_service === 1,
    createdAt: row.created_at,
  });
}

export class SqliteOrganizationRepository implements OrganizationRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(organization: Organization): Promise<void> {
    const primitives = organization.toPrimitives();
    await this.db.execute(
      `INSERT INTO organizations (id, name, slug, kind, logo_path, master_user_id, default_member_policies_json, free_service, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           slug = excluded.slug,
           kind = excluded.kind,
           logo_path = excluded.logo_path,
           master_user_id = excluded.master_user_id,
           default_member_policies_json = excluded.default_member_policies_json,
           free_service = excluded.free_service`,
      [
        primitives.id,
        primitives.name,
        primitives.slug,
        primitives.kind,
        primitives.logoPath,
        primitives.masterUserId,
        primitives.defaultMemberPoliciesJson,
        primitives.freeService ? 1 : 0,
        primitives.createdAt,
      ],
    );
  }

  public async findById(id: string): Promise<Organization | null> {
    const row = await this.db.queryRow<OrganizationRow>('SELECT * FROM organizations WHERE id = ?', [id]);
    return row ? toAggregate(row) : null;
  }

  public async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.db.queryRow<OrganizationRow>('SELECT * FROM organizations WHERE slug = ?', [
      slug.toLowerCase().trim(),
    ]);
    return row ? toAggregate(row) : null;
  }
}
