import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface SupervisionScope {
  notas: boolean;
  historias: boolean;
  pagos: boolean;
}

export interface SupervisionLinkPrimitives {
  id: string;
  organizationId: string;
  supervisorUserId: string;
  supervisedUserId: string;
  scope: SupervisionScope;
  createdAt: string;
}

/** Vínculo profesor → supervisado dentro de una organización (vista SOLO LECTURA). */
export class SupervisionLink extends AggregateRoot {
  private constructor(private readonly value: SupervisionLinkPrimitives) {
    super();
  }

  public static create(
    id: string,
    organizationId: string,
    supervisorUserId: string,
    supervisedUserId: string,
    scope: Partial<SupervisionScope> = {},
  ): SupervisionLink {
    return new SupervisionLink({
      id,
      organizationId,
      supervisorUserId,
      supervisedUserId,
      scope: {
        notas: scope.notas ?? true,
        historias: scope.historias ?? true,
        pagos: scope.pagos ?? false,
      },
      createdAt: new Date().toISOString(),
    });
  }

  public static fromPrimitives(primitives: SupervisionLinkPrimitives): SupervisionLink {
    return new SupervisionLink({ ...primitives, scope: { ...primitives.scope } });
  }

  public allowsNotes(): boolean {
    return this.value.scope.notas;
  }

  public allowsRecords(): boolean {
    return this.value.scope.historias;
  }

  public allowsPayments(): boolean {
    return this.value.scope.pagos;
  }

  public toPrimitives(): SupervisionLinkPrimitives {
    return { ...this.value, scope: { ...this.value.scope } };
  }
}
