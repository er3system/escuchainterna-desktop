import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Conexión simulada de integraciones durante el onboarding (modo local).
 * Desde la migración v6 las integraciones personales son POR PROFESIONAL
 * (owner_user_id); las filas con owner '' son los proveedores de plataforma.
 */
export type OnboardingIntegrationProvider = 'stripe' | 'google_calendar';

export async function markIntegrationSimulated(
  provider: OnboardingIntegrationProvider,
  ownerUserId: string,
): Promise<void> {
  const db = getDatabaseAdapter();
  await db.execute(
    `INSERT INTO integration_connections (id, provider, owner_user_id, status)
     VALUES (?, ?, ?, 'desconectado')
     ON CONFLICT DO NOTHING`,
    [randomUUID(), provider, ownerUserId],
  );
  await db.execute(
    `UPDATE integration_connections SET status = 'simulado', connected_at = ?
     WHERE provider = ? AND owner_user_id = ?`,
    [new Date().toISOString(), provider, ownerUserId],
  );
}

export async function getIntegrationStatuses(
  ownerUserId: string,
): Promise<Record<OnboardingIntegrationProvider, string>> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT provider, status FROM integration_connections
       WHERE provider IN ('stripe', 'google_calendar') AND owner_user_id = ?`,
    [ownerUserId],
  )) as unknown as Array<{ provider: OnboardingIntegrationProvider; status: string }>;
  const statuses: Record<OnboardingIntegrationProvider, string> = {
    stripe: 'desconectado',
    google_calendar: 'desconectado',
  };
  for (const row of rows) statuses[row.provider] = row.status;
  return statuses;
}
