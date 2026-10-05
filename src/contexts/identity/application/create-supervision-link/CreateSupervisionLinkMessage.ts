import type { SupervisionScope } from '../../domain/SupervisionLink';
import { SelfSupervisionError } from './SelfSupervisionError';

/** Creación (o actualización de alcance) de un vínculo profesor → supervisado. */
export class CreateSupervisionLinkMessage {
  private readonly linkScope: SupervisionScope;

  public constructor(
    private readonly input: {
      organizationId: string;
      actorUserId: string;
      supervisorUserId: string;
      supervisedUserId: string;
      scope: Partial<SupervisionScope>;
    },
  ) {
    if (input.supervisorUserId === input.supervisedUserId) throw new SelfSupervisionError();
    this.linkScope = {
      notas: input.scope.notas ?? true,
      historias: input.scope.historias ?? true,
      pagos: input.scope.pagos ?? false,
    };
  }

  public organizationId(): string {
    return this.input.organizationId;
  }

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public supervisorUserId(): string {
    return this.input.supervisorUserId;
  }

  public supervisedUserId(): string {
    return this.input.supervisedUserId;
  }

  public scope(): SupervisionScope {
    return { ...this.linkScope };
  }
}
