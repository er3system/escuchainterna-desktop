import { Eye } from 'lucide-react';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { getImpersonatorUserId, getSessionUserId } from '@/shared/infrastructure/auth/session';
import { stopImpersonationAction } from '@/app/admin/impersonationActions';

/**
 * Aviso persistente que aparece SOLO durante una sesión impersonada (admin
 * "viendo como" un usuario). Se autorresuelve: si no se está impersonando,
 * no renderiza nada, así que puede colocarse en cualquier layout autenticado.
 * El botón "Salir" restaura la sesión del admin real.
 */
export async function ImpersonationBanner() {
  const adminUserId = await getImpersonatorUserId();
  if (!adminUserId) return null;

  const ids = createIdentityUseCases();
  const targetUserId = await getSessionUserId();
  const target = targetUserId ? await ids.getSessionContext.get(targetUserId) : null;
  const admin = await ids.getSessionContext.get(adminUserId);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning bg-warning-soft px-4 py-2.5">
      <p className="flex items-center gap-2 text-sm text-warning">
        <Eye size={16} className="shrink-0" aria-hidden="true" />
        <span>
          Estás viendo la app <strong>como {target?.fullName || target?.email || 'este usuario'}</strong>
          {admin ? <span className="text-warning/80"> · sesión de soporte de {admin.email}</span> : null}
        </span>
      </p>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full bg-warning px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-warning/90"
        >
          Salir de la impersonación
        </button>
      </form>
    </div>
  );
}
