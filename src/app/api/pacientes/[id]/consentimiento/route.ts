import path from 'node:path';
import type { NextRequest } from 'next/server';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { getPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/getPatientFileStorage';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/**
 * Sirve la foto/escaneo del consentimiento firmado en papel del paciente
 * (v3 §2 paso 3), acotado al dueño en sesión. Disposición inline para verlo
 * en el navegador y embebido en la vista de impresión.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado', { status: 401 });
  if (context.isAssistant || context.role === 'professor') {
    return new Response('No autorizado', { status: 403 });
  }
  const userId = context.userId;

  const { id } = await params;
  const consent = await new SqlitePatientConsentRepository(userId).findLatestByPatient(id);
  const primitives = consent?.toPrimitives();
  if (!consent || !primitives || !consent.belongsTo(id) || !primitives.filePath) {
    return new Response('Consentimiento sin adjunto', { status: 404 });
  }

  // Custodia institucional (§3.3): ver el consentimiento firmado de un paciente
  // retenido es un acceso de ruptura de cristal y debe quedar trazado.
  await auditCustodyAccess(userId, id, 'resumen');

  // Lee y DESCIFRA at-rest (ver ruta de archivos): GCM requiere el buffer completo.
  const bytes = await getPatientFileStorage().read(primitives.filePath);
  if (!bytes) return new Response('Archivo no disponible', { status: 404 });
  const mime = MIME_BY_EXTENSION[path.extname(primitives.filePath).toLowerCase()] ?? 'application/octet-stream';
  const safeName = encodeURIComponent(path.basename(primitives.filePath));

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
