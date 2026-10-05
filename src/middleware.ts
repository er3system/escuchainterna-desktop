import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware: (1) expone la ruta como header `x-pathname` para que el layout del expediente
 * (`/pacientes/[id]`) sepa QUÉ área se ve (bitácora de accesos v3 §1.2) y pueda bloquear al rol
 * asistente en el servidor; (2) aplica CABECERAS DE SEGURIDAD HTTP a toda respuesta (la auditoría
 * de madurez las marcó ausentes). Van aquí —no en next.config— para tenerlas versionadas en el repo.
 */

const isDev = process.env.NODE_ENV !== 'production';

// CSP pragmática: protege contra clickjacking (frame-ancestors), inyección de <base>, plugins y
// envío de formularios fuera del sitio, SIN romper Next. script/style permiten 'unsafe-inline'
// (Next inyecta scripts/estilos en línea para hidratar; endurecerlo con nonces es un seguimiento).
// En desarrollo se añaden 'unsafe-eval' y ws: que necesita el HMR de Next.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Frame-Options', 'DENY'); // anti-clickjacking (respaldo de frame-ancestors)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  // HSTS: solo surte efecto sobre HTTPS (en http://localhost el navegador lo ignora). 2 años + subdominios.
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');

  return response;
}

export const config = {
  // Toda ruta MENOS los estáticos de Next y el favicon/manifest (no necesitan cabeceras ni x-pathname).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)'],
};
