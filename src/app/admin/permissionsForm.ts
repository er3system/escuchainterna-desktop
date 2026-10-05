import type { MembershipPermissionsPrimitives } from '@/contexts/identity/domain/value-objects/MembershipPermissions';

/**
 * Lee del FormData los campos del editor de permisos (PermissionsEditor).
 * Los nombres usan el prefijo `perm_` + clave snake_case de la spec.
 */
export function readPermissionsFromForm(
  formData: FormData,
  prefix = 'perm_',
): MembershipPermissionsPrimitives {
  const retention = Number(formData.get(`${prefix}retention_percent`) ?? 0);
  return {
    canCharge: formData.get(`${prefix}can_charge`) === 'on',
    retentionPercent: Number.isFinite(retention) ? retention : 0,
    forceAppPayments: formData.get(`${prefix}force_app_payments`) === 'on',
    paymentsDisabled: formData.get(`${prefix}payments_disabled`) === 'on',
    canSupervisePatients: formData.get(`${prefix}can_supervise_patients`) === 'on',
    canConfigurePayments: formData.get(`${prefix}can_configure_payments`) === 'on',
  };
}
