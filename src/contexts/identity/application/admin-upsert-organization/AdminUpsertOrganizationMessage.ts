import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '../../domain/value-objects/MembershipPermissions';
import type { OrganizationKind } from '../../domain/Organization';

const ORGANIZATION_KINDS: OrganizationKind[] = ['empresa', 'universidad', 'clinica'];

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Crear/editar organización desde /admin. */
export class AdminUpsertOrganizationMessage {
  private readonly actor: string;
  private readonly orgId: string | null;
  private readonly orgName: string;
  private readonly orgSlug: string;
  private readonly orgKind: OrganizationKind;
  private readonly master: string | null;
  private readonly defaultPermissions: MembershipPermissions | null;
  private readonly orgFreeService: boolean | null;

  public constructor(input: {
    actorUserId: string;
    /** null ⇒ crear; id existente ⇒ editar. */
    organizationId?: string | null;
    name: string;
    slug: string;
    kind: string;
    masterUserId?: string | null;
    /** Políticas por defecto para nuevos miembros; null ⇒ conservar/vacío. */
    defaultPermissions?: MembershipPermissionsPrimitives | null;
    /** Servicio sin costo (v3 §3); null/undefined ⇒ conservar (o false al crear). */
    freeService?: boolean | null;
  }) {
    this.actor = input.actorUserId;
    this.orgId = input.organizationId?.trim() || null;
    this.orgName = input.name.trim();
    if (!this.orgName) throw new Error('El nombre de la organización es obligatorio.');
    this.orgSlug = normalizeSlug(input.slug || input.name);
    if (!this.orgSlug) throw new Error('El slug de la organización es obligatorio.');
    this.orgKind = (ORGANIZATION_KINDS as string[]).includes(input.kind)
      ? (input.kind as OrganizationKind)
      : 'empresa';
    this.master = input.masterUserId?.trim() || null;
    this.defaultPermissions = input.defaultPermissions
      ? MembershipPermissions.fromPrimitives(input.defaultPermissions)
      : null;
    this.orgFreeService = typeof input.freeService === 'boolean' ? input.freeService : null;
  }

  public actorUserId(): string {
    return this.actor;
  }

  public organizationId(): string | null {
    return this.orgId;
  }

  public name(): string {
    return this.orgName;
  }

  public slug(): string {
    return this.orgSlug;
  }

  public kind(): OrganizationKind {
    return this.orgKind;
  }

  public masterUserId(): string | null {
    return this.master;
  }

  public defaultMemberPolicies(): MembershipPermissions | null {
    return this.defaultPermissions;
  }

  /** null ⇒ no tocar el valor actual. */
  public freeService(): boolean | null {
    return this.orgFreeService;
  }
}
