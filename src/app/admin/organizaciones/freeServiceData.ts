import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Read model mínimo del flag `organizations.free_service` para el formulario
 * de /admin/organizaciones (v3 §3: el admin también puede activar el servicio
 * sin costo de una organización). Solo lectura; la escritura pasa por
 * AdminUpsertOrganization.
 */
export async function organizationHasFreeService(organizationId: string): Promise<boolean> {
  const row = (await getDatabaseAdapter().queryRow(
    'SELECT free_service FROM organizations WHERE id = ?',
    [organizationId],
  )) as { free_service: number } | null;
  return row ? row.free_service === 1 : false;
}
