import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { createAdminUseCases } from '@/contexts/identity/infrastructure/createAdminUseCases';
import { exportAccountData } from '@/shared/infrastructure/account-data/AccountDataExport';

/**
 * Exporta TODOS los datos de una cuenta en JSON (habeas data §acceso/portabilidad,
 * Ley 1581). Solo admin de plataforma; queda registrado en admin_audit_log.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return new Response('No autenticado', { status: 401 });

  const context = await createIdentityUseCases().getSessionContext.get(sessionUserId);
  if (!context || context.role !== 'admin' || context.status === 'suspendido') {
    return new Response('No autorizado', { status: 403 });
  }

  const { userId } = await params;
  const data = await exportAccountData(userId);
  if (!data.account) return new Response('Cuenta no encontrada', { status: 404 });

  await createAdminUseCases().audit.record({
    actorUserId: sessionUserId,
    action: 'exportar_datos_cuenta',
    target: (data.account.email as string) ?? userId,
    details: { userId },
  });

  const json = JSON.stringify(data, null, 2);
  const slug = String(data.account.email ?? userId).replace(/[^a-z0-9]+/gi, '-');
  return new Response(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="datos-cuenta-${slug}.json"`,
    },
  });
}
