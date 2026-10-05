import path from 'node:path';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { getFileStorage } from '@/shared/infrastructure/files/getFileStorage';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/**
 * Sirve el logo de una organización desde data/uploads/orgs/<orgId>/.
 * Es público a propósito: aparece en la página pública de reservas de los
 * miembros además del sidebar (un logo no es dato clínico ni operativo).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = (await getDatabaseAdapter().queryRow(
    'SELECT logo_path FROM organizations WHERE id = ?',
    [id],
  )) as { logo_path: string | null } | null;
  if (!row?.logo_path) return new Response('Sin logo', { status: 404 });

  const file = await getFileStorage().read(row.logo_path);
  if (!file) return new Response('Sin logo', { status: 404 });

  const extension = path.extname(row.logo_path).toLowerCase();
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=300',
      // Los maestros pueden subir SVG. Si alguien abre el recurso directamente,
      // el sandbox impide que un SVG activo ejecute scripts con el origen de la app.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
