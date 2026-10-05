import fs from 'node:fs';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import { resolvePublicationAssetPath } from '@/contexts/library/infrastructure/filesystem/PublicationManifestReader';

/**
 * Descarga del PDF de una publicación de la Colección EscuchaInterna. Las
 * publicaciones son contenido de plataforma (global, sin owner_user_id): basta la
 * sesión iniciada. La ruta del PDF se resuelve con `resolvePublicationAssetPath`,
 * que SOLO admite archivos dentro de data/publicaciones (sin path traversal).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await getActiveAppSessionContext())) return new Response('No autorizado', { status: 401 });

  const { id } = await params;
  const publication = await new SqlitePublicationRepository().findById(id);
  if (!publication || !publication.hasPdf()) {
    return new Response('Publicación no encontrada', { status: 404 });
  }

  const primitives = publication.toPrimitives();
  const absolutePath = resolvePublicationAssetPath(primitives.pdfPath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return new Response('Archivo no disponible', { status: 404 });
  }

  const stat = fs.statSync(absolutePath);
  // Readable.toWeb evita el doble cierre del stream al castear un ReadStream de Node.
  const stream = Readable.toWeb(fs.createReadStream(absolutePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${primitives.id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
