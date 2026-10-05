import { NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

// Sonda de salud/readiness: verifica que la BD responde y que las migraciones corrieron. Útil para
// el balanceador/orquestador (Docker/K8s) — detecta una BD corrupta o una inicialización a medias
// antes de enrutar tráfico. Siempre dinámica (no se cachea).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDatabaseAdapter();
    await db.queryRow('SELECT 1');
    // Versión de esquema AGNÓSTICA del motor: PRAGMA user_version es solo-SQLite
    // (en Postgres lanzaba → la sonda respondía 503 con la BD sana). En Postgres
    // se cuenta schema_migrations (el runner 12-factor de bin/migrate).
    let schemaVersion = 0;
    try {
      const row = (await db.queryRow('PRAGMA user_version')) as { user_version: number } | null;
      schemaVersion = row?.user_version ?? 0;
    } catch {
      const row = (await db.queryRow('SELECT COUNT(*) AS n FROM schema_migrations')) as { n: number } | null;
      schemaVersion = row?.n ?? 0;
    }
    // Diagnóstico de despliegue (NO sensible): confirma qué motor usa la app en
    // vivo. Si DATABASE_URL no llega al runtime, getDatabaseAdapter cae a SQLite
    // (efímero, sin el admin sembrado) y el login falla con "credenciales
    // incorrectas" aunque la credencial sea correcta en Postgres. `admins` cierra
    // el diagnóstico: 1 = la app lee el Postgres sembrado; 0 = BD equivocada/vacía.
    const dbUrlPresent = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
    let admins: number | null = null;
    try {
      const row = (await db.queryRow("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")) as
        | { n: number }
        | null;
      admins = row ? Number(row.n) : 0;
    } catch {
      admins = null;
    }
    return NextResponse.json(
      {
        status: 'ok',
        engine: dbUrlPresent ? 'postgres' : 'sqlite',
        dbUrlPresent,
        appEnv: process.env.APP_ENV ?? null,
        schemaVersion,
        admins,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // No se filtra el detalle del error (endpoint público sin sesión): solo el estado degradado.
    return NextResponse.json({ status: 'error' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
