import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface AssistantPermissions {
  agenda: boolean;
  pagos: boolean;
  pacientesBasico: boolean;
}

export interface AssistantPrimitives {
  id: string;
  /** Titular (psicólogo/a) cuyos datos opera el asistente. */
  ownerUserId: string;
  /** Cuenta de usuario con role='assistant'. */
  assistantUserId: string;
  permissions: AssistantPermissions;
  createdAt: string;
}

const DEFAULT_PERMISSIONS: AssistantPermissions = {
  agenda: true,
  pagos: true,
  pacientesBasico: true,
};

/**
 * Vínculo asistente/recepcionista → titular (v3 §4): el asistente opera la
 * agenda, los pagos y los datos de contacto de pacientes DEL TITULAR, nunca
 * el expediente clínico.
 */
export class Assistant extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly ownerUserId: string,
    private readonly assistantUserId: string,
    private readonly permissions: AssistantPermissions,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static create(id: string, ownerUserId: string, assistantUserId: string): Assistant {
    return new Assistant(id, ownerUserId, assistantUserId, { ...DEFAULT_PERMISSIONS }, new Date());
  }

  public static fromPrimitives(primitives: AssistantPrimitives): Assistant {
    return new Assistant(
      primitives.id,
      primitives.ownerUserId,
      primitives.assistantUserId,
      primitives.permissions,
      new Date(primitives.createdAt),
    );
  }

  public assistantId(): string {
    return this.id;
  }

  public dataOwnerUserId(): string {
    return this.ownerUserId;
  }

  public accountUserId(): string {
    return this.assistantUserId;
  }

  public isOwnedBy(userId: string): boolean {
    return this.ownerUserId === userId;
  }

  public toPrimitives(): AssistantPrimitives {
    return {
      id: this.id,
      ownerUserId: this.ownerUserId,
      assistantUserId: this.assistantUserId,
      permissions: { ...this.permissions },
      createdAt: this.createdAt.toISOString(),
    };
  }
}
