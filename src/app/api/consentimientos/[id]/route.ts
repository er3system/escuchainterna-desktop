import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { SqliteConsentInboxRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentInboxRepository';
import { ConsentReceptionId } from '@/contexts/clinical-records/domain/value-objects/ConsentReceptionId';
import { LocalPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/LocalPatientFileStorage';
export async function GET(_request: Request, { params }: { params: Promise<{id:string}> }) {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado', { status:401 });
  if (!isDesktopEdition() || context.isAssistant || context.role === 'professor') return new Response('No autorizado', { status:403 });
  const {id} = await params; let identity: ConsentReceptionId;
  try { identity = new ConsentReceptionId(id); } catch { return new Response('Documento no disponible', {status:404}); }
  const receipt = await new SqliteConsentInboxRepository(context.userId).find(identity);
  if (!receipt) return new Response('Documento no disponible', {status:404});
  const p = receipt.toPrimitives(); if (p.patientId) await auditCustodyAccess(context.userId, p.patientId, 'resumen');
  const data = await new LocalPatientFileStorage().read(p.document.storedPath);
  if (!data) return new Response('Archivo no disponible', {status:404});
  return new Response(data as unknown as BodyInit, { headers: {'Content-Type':p.document.mime,'Content-Length':String(data.byteLength),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(p.document.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"} });
}
