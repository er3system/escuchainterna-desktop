/**
 * Backfill explícito de credenciales de integraciones en PostgreSQL.
 * Se ejecuta DESPUÉS de desplegar el lector dual para que un rollback previo
 * al deploy nunca deje al código viejo frente a envelopes que no comprende.
 */
import { getPostgresAdapter } from '../src/shared/infrastructure/persistence/PostgresAdapter';
import { encryptExistingIntegrationConfigsOnAdapter } from '../src/shared/infrastructure/persistence/integrationConfigEncryption';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL: este pase apunta exclusivamente a PostgreSQL.');
  }
  const adapter = getPostgresAdapter();
  try {
    const encrypted = await encryptExistingIntegrationConfigsOnAdapter(adapter);
    console.log(
      `bin/encrypt-integration-configs: pase completo; ${encrypted} configuración(es) legacy cifrada(s).`,
    );
  } finally {
    await adapter.close();
  }
}

main().catch((error) => {
  console.error(
    'bin/encrypt-integration-configs: FALLÓ —',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
