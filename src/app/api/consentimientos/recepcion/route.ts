import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { FolderConsentReceiver } from '@/contexts/clinical-records/infrastructure/consent-reception/FolderConsentReceiver';

/** La revisión de fondo no modifica el estado del router de Next. */
export async function POST(request: Request): Promise<Response> {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado', { status: 401 });
  if (!isDesktopEdition() || context.isAssistant || context.role === 'professor') return new Response('No autorizado', { status: 403 });
  const origin = process.env.APP_URL ?? '';
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
    || request.headers.get('host') !== new URL(origin).host
    || request.headers.get('origin') !== origin
    || request.headers.get('x-escucha-consent-reception') !== '1') {
    return new Response('Solicitud no autorizada', { status: 403 });
  }
  try {
    return Response.json(await new FolderConsentReceiver(context.userId).receive(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return new Response('No se pudo revisar la recepción.', { status: 503 });
  }
}
