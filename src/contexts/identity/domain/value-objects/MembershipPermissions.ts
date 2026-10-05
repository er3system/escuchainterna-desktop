import { InvalidMembershipPermissionsError } from '../errors/InvalidMembershipPermissionsError';

/** Forma serializable (camelCase) de los permisos; segura para client components vía `import type`. */
export interface MembershipPermissionsPrimitives {
  canCharge: boolean;
  retentionPercent: number;
  forceAppPayments: boolean;
  paymentsDisabled: boolean;
  canSupervisePatients: boolean;
  canConfigurePayments: boolean;
}

/** Forma JSON persistida en organization_memberships.permissions_json (claves snake_case de la spec). */
interface MembershipPermissionsJson {
  can_charge?: boolean;
  retention_percent?: number;
  force_app_payments?: boolean;
  payments_disabled?: boolean;
  can_supervise_patients?: boolean;
  can_configure_payments?: boolean;
}

/**
 * Permisos de un miembro dentro de su organización.
 * Invariantes: retención 0–100; `payments_disabled` es el alias duro de
 * `can_charge=false` (si está activo, el miembro NUNCA puede cobrar).
 */
export class MembershipPermissions {
  private constructor(private readonly value: MembershipPermissionsPrimitives) {
    if (!Number.isFinite(value.retentionPercent) || value.retentionPercent < 0 || value.retentionPercent > 100) {
      throw new InvalidMembershipPermissionsError(
        `retention_percent debe estar entre 0 y 100 (recibido: ${value.retentionPercent}).`,
      );
    }
  }

  public static defaults(): MembershipPermissions {
    return new MembershipPermissions({
      canCharge: true,
      retentionPercent: 0,
      forceAppPayments: false,
      paymentsDisabled: false,
      canSupervisePatients: false,
      canConfigurePayments: true,
    });
  }

  public static fromPrimitives(primitives: MembershipPermissionsPrimitives): MembershipPermissions {
    return new MembershipPermissions({ ...primitives });
  }

  /** Parsea el JSON persistido; los campos ausentes toman los valores por defecto. */
  public static fromJson(json: string): MembershipPermissions {
    let parsed: MembershipPermissionsJson = {};
    try {
      const raw = JSON.parse(json || '{}') as unknown;
      if (raw && typeof raw === 'object') parsed = raw as MembershipPermissionsJson;
    } catch {
      parsed = {};
    }
    const base = MembershipPermissions.defaults().toPrimitives();
    return new MembershipPermissions({
      canCharge: typeof parsed.can_charge === 'boolean' ? parsed.can_charge : base.canCharge,
      retentionPercent:
        typeof parsed.retention_percent === 'number' ? parsed.retention_percent : base.retentionPercent,
      forceAppPayments:
        typeof parsed.force_app_payments === 'boolean' ? parsed.force_app_payments : base.forceAppPayments,
      paymentsDisabled:
        typeof parsed.payments_disabled === 'boolean' ? parsed.payments_disabled : base.paymentsDisabled,
      canSupervisePatients:
        typeof parsed.can_supervise_patients === 'boolean'
          ? parsed.can_supervise_patients
          : base.canSupervisePatients,
      canConfigurePayments:
        typeof parsed.can_configure_payments === 'boolean'
          ? parsed.can_configure_payments
          : base.canConfigurePayments,
    });
  }

  /** ¿Puede cobrar de verdad? payments_disabled manda sobre can_charge. */
  public canActuallyCharge(): boolean {
    return this.value.canCharge && !this.value.paymentsDisabled;
  }

  public paymentsAreDisabled(): boolean {
    return this.value.paymentsDisabled || !this.value.canCharge;
  }

  public canSupervise(): boolean {
    return this.value.canSupervisePatients;
  }

  public canConfigurePayments(): boolean {
    return this.value.canConfigurePayments && !this.paymentsAreDisabled();
  }

  public mustUseAppPayments(): boolean {
    return this.value.forceAppPayments && this.canActuallyCharge();
  }

  public retention(): number {
    return this.value.retentionPercent;
  }

  public toPrimitives(): MembershipPermissionsPrimitives {
    return { ...this.value };
  }

  public toJson(): string {
    return JSON.stringify({
      can_charge: this.value.canCharge,
      retention_percent: this.value.retentionPercent,
      force_app_payments: this.value.forceAppPayments,
      payments_disabled: this.value.paymentsDisabled,
      can_supervise_patients: this.value.canSupervisePatients,
      can_configure_payments: this.value.canConfigurePayments,
    });
  }
}
