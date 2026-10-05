import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export type OrganizationKind = 'empresa' | 'universidad' | 'clinica';

export interface OrganizationPrimitives {
  id: string;
  name: string;
  slug: string;
  kind: OrganizationKind;
  logoPath: string | null;
  masterUserId: string | null;
  defaultMemberPoliciesJson: string;
  /**
   * Servicio sin costo (v3 §3, universidades): las consultas de TODOS los
   * miembros son gratuitas para los pacientes — pagos deshabilitados en
   * sesión, sin precios en la página pública y sin paso de pago en onboarding.
   */
  freeService: boolean;
  createdAt: string;
}

/** Perfil maestro: empresa, universidad o clínica con varios profesionales. */
export class Organization extends AggregateRoot {
  private constructor(private readonly value: OrganizationPrimitives) {
    super();
  }

  public static create(
    id: string,
    name: string,
    slug: string,
    kind: OrganizationKind,
    masterUserId: string | null,
  ): Organization {
    return new Organization({
      id,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      kind,
      logoPath: null,
      masterUserId,
      defaultMemberPoliciesJson: '{}',
      freeService: false,
      createdAt: new Date().toISOString(),
    });
  }

  public static fromPrimitives(primitives: OrganizationPrimitives): Organization {
    return new Organization({ ...primitives });
  }

  public organizationId(): string {
    return this.value.id;
  }

  public toPrimitives(): OrganizationPrimitives {
    return { ...this.value };
  }
}
