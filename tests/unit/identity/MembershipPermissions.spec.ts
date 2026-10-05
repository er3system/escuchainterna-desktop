import { describe, it, expect } from 'vitest';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { InvalidMembershipPermissionsError } from '@/contexts/identity/domain/errors/InvalidMembershipPermissionsError';

describe('MembershipPermissions', () => {
  it('los valores por defecto permiten cobrar sin retención', () => {
    const permissions = MembershipPermissions.defaults();
    expect(permissions.canActuallyCharge()).toBe(true);
    expect(permissions.paymentsAreDisabled()).toBe(false);
    expect(permissions.retention()).toBe(0);
    expect(permissions.canSupervise()).toBe(false);
    expect(permissions.canConfigurePayments()).toBe(true);
  });

  it('parsea el JSON persistido con claves snake_case y completa los campos ausentes', () => {
    const permissions = MembershipPermissions.fromJson(
      '{"retention_percent": 10, "can_supervise_patients": true}',
    );
    expect(permissions.retention()).toBe(10);
    expect(permissions.canSupervise()).toBe(true);
    expect(permissions.canActuallyCharge()).toBe(true); // default
  });

  it('payments_disabled es el alias duro: manda sobre can_charge=true', () => {
    const permissions = MembershipPermissions.fromJson('{"can_charge": true, "payments_disabled": true}');
    expect(permissions.canActuallyCharge()).toBe(false);
    expect(permissions.paymentsAreDisabled()).toBe(true);
    expect(permissions.canConfigurePayments()).toBe(false);
    expect(permissions.mustUseAppPayments()).toBe(false);
  });

  it('can_charge=false también deshabilita los pagos', () => {
    const permissions = MembershipPermissions.fromJson('{"can_charge": false}');
    expect(permissions.paymentsAreDisabled()).toBe(true);
  });

  it('force_app_payments solo aplica cuando el miembro puede cobrar', () => {
    const enabled = MembershipPermissions.fromJson('{"force_app_payments": true}');
    expect(enabled.mustUseAppPayments()).toBe(true);
    const disabled = MembershipPermissions.fromJson(
      '{"force_app_payments": true, "payments_disabled": true}',
    );
    expect(disabled.mustUseAppPayments()).toBe(false);
  });

  it('rechaza retenciones fuera de 0-100', () => {
    expect(() =>
      MembershipPermissions.fromPrimitives({
        canCharge: true,
        retentionPercent: 120,
        forceAppPayments: false,
        paymentsDisabled: false,
        canSupervisePatients: false,
        canConfigurePayments: true,
      }),
    ).toThrow(InvalidMembershipPermissionsError);
  });

  it('un JSON corrupto cae a los valores por defecto', () => {
    const permissions = MembershipPermissions.fromJson('esto no es json');
    expect(permissions.canActuallyCharge()).toBe(true);
    expect(permissions.retention()).toBe(0);
  });

  it('el ciclo toJson → fromJson conserva los permisos', () => {
    const original = MembershipPermissions.fromJson(
      '{"can_charge": true, "retention_percent": 25, "can_supervise_patients": true, "can_configure_payments": false}',
    );
    const restored = MembershipPermissions.fromJson(original.toJson());
    expect(restored.toPrimitives()).toEqual(original.toPrimitives());
  });
});
