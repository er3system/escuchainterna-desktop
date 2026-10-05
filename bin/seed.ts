/**
 * Paso de SEED de despliegue: siembra los datos de REFERENCIA de la plataforma
 * (planes, CIE-11, costeo de IA, plantillas clínicas, integraciones globales,
 * automatizaciones y —si ADMIN_BOOTSTRAP_* está definido— el primer admin) en la
 * base de `DATABASE_URL`. Idempotente. NO siembra datos demo (eso es solo-dev).
 *
 *   DATABASE_URL=postgres://… npx tsx bin/seed.ts        # o:  npm run db:seed
 *   (correr DESPUÉS de bin/migrate)
 */
import { getPostgresAdapter } from '../src/shared/infrastructure/persistence/PostgresAdapter';
import { runSeedOnAdapter } from '../src/shared/infrastructure/persistence/seed';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('bin/seed: falta DATABASE_URL (Postgres). En SQLite el seed corre solo al abrir getDb().');
    process.exit(1);
  }
  const adapter = getPostgresAdapter();
  try {
    await runSeedOnAdapter(adapter);
    const plans = await adapter.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM plans');
    const cie11 = await adapter.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM cie11_entries');
    console.log(`bin/seed: OK. planes=${plans?.n}, cie11=${cie11?.n}`);
  } finally {
    await adapter.close();
  }
}

main().catch((error) => {
  console.error('bin/seed: FALLÓ —', error instanceof Error ? error.message : error);
  process.exit(1);
});
