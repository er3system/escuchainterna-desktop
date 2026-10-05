import { CompleteGoogleCalendarMessage } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarMessages';
import { calendarAuthorization, createGoogleCalendarConsultation, withCalendarOwner } from '@/contexts/practitioner/infrastructure/google-calendar/createGoogleCalendarConsultation';
import { GoogleCalendarAccessError } from '@/contexts/practitioner/domain/errors/GoogleCalendarAccessError';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { revalidatePath } from 'next/cache';
import { LoopbackGoogleAuthorization } from '@/contexts/practitioner/infrastructure/google-calendar/LoopbackGoogleAuthorization';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function response(message: string, status: number): Response {
  const escaped = message.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EscuchaInterna · Google Calendar</title><body><main><h1>Google Calendar</h1><p>${escaped}</p><p>Puedes cerrar esta pestaña y regresar a EscuchaInterna.</p></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } });
}
export async function GET(request: Request): Promise<Response> {
  if (!isDesktopEdition()) return response('Esta conexión requiere la aplicación de escritorio.', 404);
  try {
    const url = new URL(request.url);
    // Next normaliza 127.0.0.1 a localhost en Request.url. Comparar el Host recibido
    // con el origen configurado; nunca construir un redirect desde headers del cliente.
    const origin = LoopbackGoogleAuthorization.validateOrigin(process.env.APP_URL ?? '');
    if (request.headers.get('host') !== new URL(origin).host || (request.headers.has('origin') && request.headers.get('origin') !== origin)) throw new GoogleCalendarAccessError('El retorno de Google no corresponde a esta instalación.');
    const message = new CompleteGoogleCalendarMessage(url.searchParams.get('state') ?? '', url.searchParams.get('code') ?? '', origin, url.searchParams.has('error'));
    const owner = calendarAuthorization().ownerFor(message.state);
    await withCalendarOwner(owner, () => createGoogleCalendarConsultation().complete(message));
    for (const path of ['/agenda', '/configuracion/google-calendar', '/configuracion/integraciones']) revalidatePath(path);
    return response('Cuenta conectada. Ya puedes revisar coincidencias y publicar horarios desde la app.', 200);
  } catch (error) { return response(error instanceof GoogleCalendarAccessError ? error.message : 'No se pudo completar la conexión. Regresa a la app e intenta de nuevo.', 400); }
}
