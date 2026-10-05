import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { getUserLimitOverrides } from '../billing-overrides/UserLimitOverrides';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { isDesktopEdition } from '../config/desktopEdition';

/**
 * Cuota de almacenamiento de adjuntos POR DUEÑO, según el plan. El tope POR
 * ARCHIVO (20 MB) vive en UploadPatientFileMessage; esto es el tope ACUMULADO.
 * Admin = sin límite. Miembro sin suscripción propia (cubierto por su org) =
 * plan 'profesional'. Plan sin `storage_limit_gb` = default. La cuota agrupada
 * por organización queda para la fase de propiedad-org (hoy es por owner).
 */

export const BYTES_PER_GB = 1024 * 1024 * 1024;

/** Default si el plan no define `storage_limit_gb`. */
export const DEFAULT_STORAGE_LIMIT_GB = 15;

export interface StorageUsage {
  usedBytes: number;
  /** Tope en bytes, o null = sin límite (admin). */
  limitBytes: number | null;
}

/** Helper PURO: ¿subir `fileBytes` excede la cuota dado el uso actual? */
export function wouldExceedQuota(usedBytes: number, fileBytes: number, limitBytes: number | null): boolean {
  if (limitBytes === null) return false;
  return usedBytes + fileBytes > limitBytes;
}

/** Tope de almacenamiento del dueño en bytes (null = sin límite). */
export async function resolveStorageLimitBytes(ownerUserId: string): Promise<number | null> {
  // En PC el espacio disponible lo determina el disco, sin una cuota comercial.
  // El límite por archivo y la comprobación de propiedad permanecen vigentes.
  if (isDesktopEdition()) return null;
  const db = getDatabaseAdapter();
  const user = await db.queryRow<{ role: string }>('SELECT role FROM users WHERE id = ?', [ownerUserId]);
  if (user && user.role === 'admin') return null;

  const subscription = await db.queryRow<{ plan: string }>(
    'SELECT plan FROM subscriptions WHERE user_id = ?',
    [ownerUserId],
  );
  const planId = subscription ? subscription.plan : 'profesional';

  const plan = await db.queryRow<{ storage_limit_gb: number | null }>(
    'SELECT storage_limit_gb FROM plans WHERE id = ?',
    [planId],
  );
  const planGb = plan && plan.storage_limit_gb !== null ? plan.storage_limit_gb : DEFAULT_STORAGE_LIMIT_GB;
  // Override por cuenta (v27): si está presente, pisa a la cuota del plan.
  const override = (await getUserLimitOverrides(ownerUserId)).storageLimitGb;
  const gb = override ?? planGb;
  return gb * BYTES_PER_GB;
}

/** Uso y tope actuales del dueño (para mostrar y para enforcement). */
export async function getStorageUsage(ownerUserId: string): Promise<StorageUsage> {
  return {
    usedBytes: await new SqlitePatientFileRepository(ownerUserId).totalSizeForOwner(),
    limitBytes: await resolveStorageLimitBytes(ownerUserId),
  };
}
