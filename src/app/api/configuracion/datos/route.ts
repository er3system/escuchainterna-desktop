import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { exportAccountData } from '@/shared/infrastructure/account-data/AccountDataExport';

/**
 * Habeas data en AUTOSERVICIO (Ley 1581, derecho de acceso y portabilidad): el usuario
 * autenticado descarga TODOS sus propios datos en JSON. Acotado a su propia cuenta (el
 * userId sale de la sesión, nunca de la URL) y NUNCA incluye el hash de contraseña
 * (exportAccountData lo excluye). El export del admin (otra cuenta) sigue gateado aparte.
 */
export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return new Response('No autenticado', { status: 401 });

  const data = await exportAccountData(userId);
  if (!data.account) return new Response('Cuenta no encontrada', { status: 404 });

  const json = JSON.stringify(data, null, 2);
  const slug = String(data.account.email ?? userId).replace(/[^a-z0-9]+/gi, '-');
  return new Response(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mis-datos-${slug}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
