import type { NextRequest } from 'next/server';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { getPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/getPatientFileStorage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado', { status: 401 });
  if (context.isAssistant || context.role === 'professor') {
    return new Response('No autorizado', { status: 403 });
  }
  const userId = context.userId;

  const { id, fileId } = await params;
  const file = await new SqlitePatientFileRepository(userId).findById(fileId);
  if (!file || !file.belongsTo(id)) return new Response('Archivo no encontrado', { status: 404 });

  // Custodia institucional (§3.3): descargar un adjunto de un paciente retenido es un
  // acceso de ruptura de cristal (no pasa por el layout) y debe quedar trazado.
  await auditCustodyAccess(userId, id, 'archivos');

  const primitives = file.toPrimitives();
  // Lee y DESCIFRA at-rest (los adjuntos pueden ser grandes pero acotados; el descifrado
  // GCM requiere el buffer completo, por eso no se transmite por stream).
  const bytes = await getPatientFileStorage().read(primitives.storedPath);
  if (!bytes) return new Response('Archivo no disponible', { status: 404 });
  const safeName = encodeURIComponent(primitives.filename);

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': primitives.mime || 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `attachment; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
