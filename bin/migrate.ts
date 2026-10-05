/**
 * Paso de migración de despliegue (12-factor): aplica el esquema a la base de
 * datos de la `DATABASE_URL` ANTES de arrancar la app, en vez de migrar en el
 * primer `getDb()`. Idempotente (usa la tabla `schema_migrations`).
 *
 *   DATABASE_URL=postgres://… npx tsx bin/migrate.ts      # o:  npm run db:migrate
 *
 * Importa por rutas RELATIVAS (no alias `@/`) para correr bajo tsx sin resolver
 * tsconfig paths, y SOLO toca la capa portable (Postgres + runner async): no
 * carga node:sqlite ni el seed.
 */
import { getPostgresAdapter } from '../src/shared/infrastructure/persistence/PostgresAdapter';
import {
  runMigrationsOnAdapter,
  LATEST_SCHEMA_VERSION,
} from '../src/shared/infrastructure/persistence/migrations';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'bin/migrate: falta DATABASE_URL (Postgres). En SQLite (dev) las migraciones corren solas al abrir getDb().',
    );
    process.exit(1);
  }

  // Reutiliza la misma política TLS que la aplicación. Así los proveedores
  // gestionados (Supabase, Neon, RDS…) funcionan aunque DATABASE_URL no traiga
  // `sslmode=require`, sin divergir del runtime que acabamos de compilar.
  const adapter = getPostgresAdapter();
  try {
    const before = await adapter.queryRow<{ v: number | null }>(
      "SELECT MAX(version) AS v FROM schema_migrations WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations')",
    ).catch(() => ({ v: null }));
    console.log(`bin/migrate: versión actual = ${before?.v ?? 0}, objetivo = ${LATEST_SCHEMA_VERSION}`);

    await runMigrationsOnAdapter(adapter);

    const after = await adapter.queryRow<{ v: number }>(
      'SELECT MAX(version) AS v FROM schema_migrations',
    );
    console.log(`bin/migrate: esquema al día en versión ${after?.v}. OK.`);
  } finally {
    await adapter.close();
  }
}

main().catch((error) => {
  console.error('bin/migrate: FALLÓ —', error instanceof Error ? error.message : error);
  process.exit(1);
});
