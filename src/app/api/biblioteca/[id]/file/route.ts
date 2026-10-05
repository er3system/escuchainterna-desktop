import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { SqliteBookRepository } from '@/contexts/library/infrastructure/persistence/SqliteBookRepository';
import { libraryRootPath } from '@/contexts/library/infrastructure/filesystem/LibraryFolderScanner';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getActiveAppSessionContext())) return new Response('No autorizado', { status: 401 });

  const { id } = await params;
  const book = await new SqliteBookRepository().findById(id);
  if (!book) return new Response('Libro no encontrado', { status: 404 });

  const primitives = book.toPrimitives();
  const rootPath = path.resolve(libraryRootPath());
  const absolutePath = path.resolve(rootPath, primitives.relativePath);
  const relativePath = path.relative(rootPath, absolutePath);
  // El catálogo solo contiene rutas dentro de la biblioteca; este check evita escapes.
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    !fs.existsSync(absolutePath)
  ) {
    return new Response('Archivo no disponible', { status: 404 });
  }

  const stat = fs.statSync(absolutePath);
  // Readable.toWeb evita el doble cierre del stream (uncaughtException
  // "ReadableStream is already closed") al castear un ReadStream de Node.
  const stream = Readable.toWeb(fs.createReadStream(absolutePath)) as ReadableStream;
  const disposition = book.isReadableInBrowser() ? 'inline' : 'attachment';
  const safeName = encodeURIComponent(path.basename(primitives.relativePath));

  return new Response(stream, {
    headers: {
      'Content-Type': MIME_BY_EXTENSION[primitives.extension] ?? 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
