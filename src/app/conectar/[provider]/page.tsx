import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, FlaskConical, Lock, ShieldCheck } from 'lucide-react';
import { isPaymentGatewayProvider } from '@/contexts/practitioner/domain/paymentGateways';
import { requirePaymentConfigurationAccess } from '@/shared/infrastructure/auth/dataOwner';
import { authorizeSimulatedLinkAction } from './actions';
import { CONNECT_PROVIDER_META, safeReturnPath } from './conectarMeta';

export const metadata: Metadata = {
  title: 'Conectar cuenta · EscuchaInterna',
};

/**
 * Pantalla SIMULADA de autorización del proveedor (vinculación "con un clic").
 *
 * En producción esta pantalla no existe en la app: el profesional es
 * redirigido al consentimiento real del proveedor (Stripe Connect OAuth /
 * Mercado Pago OAuth / PayPal Partner Referrals) y vuelve por un callback.
 * Aquí se imita esa pantalla con estética neutra del proveedor para que el
 * flujo completo sea recorrible en modo local.
 */
export default async function ConectarProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ volver?: string }>;
}) {
  const { provider } = await params;
  const { volver } = await searchParams;
  if (!isPaymentGatewayProvider(provider)) notFound();
  await requirePaymentConfigurationAccess();

  const back = safeReturnPath(volver);
  const meta = CONNECT_PROVIDER_META[provider];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex items-start gap-2 border-b border-warning bg-warning-soft px-4 py-2.5 text-xs text-ink">
        <FlaskConical size={14} className="mt-0.5 shrink-0 text-warning" />
        <p>
          <span className="font-semibold">Simulación local</span> — en producción esta pantalla es de {meta.name} (
          {meta.realFlow}) y EscuchaInterna nunca ve tu contraseña.
        </p>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* "Pantalla del proveedor": logo-texto + consentimiento */}
          <div className="rounded-card border border-line bg-surface p-8 shadow-card">
            <p
              className="text-center text-3xl font-extrabold tracking-tight"
              style={{ color: meta.accentColor }}
            >
              {meta.logoText}
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-ink-soft">
              <Lock size={12} /> Autorización de acceso
            </p>

            <div className="mt-6 rounded-lg border border-line bg-bg px-4 py-3">
              <p className="text-sm text-ink">
                <span className="font-semibold">EscuchaInterna</span> solicita permiso para:
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                  Crear cobros a tu nombre
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                  Consultar el estado de tus pagos
                </li>
              </ul>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs text-ink">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
              <span>
                El dinero llega <span className="font-bold">SIEMPRE</span> a tu cuenta de {meta.name};
                EscuchaInterna no puede retirar fondos ni tocar tu saldo.
              </span>
            </p>

            <form action={authorizeSimulatedLinkAction} className="mt-6 space-y-2">
              <input type="hidden" name="provider" value={provider} />
              <input type="hidden" name="volver" value={back} />
              <button
                type="submit"
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: meta.accentColor }}
              >
                Autorizar
              </button>
              <Link
                href={back}
                className="block w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-center text-sm font-medium text-ink transition hover:bg-bg"
              >
                Cancelar
              </Link>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-ink-soft">
            Al autorizar, tu cuenta de {meta.name} queda vinculada en modo local con un identificador de
            demostración. Puedes desvincularla cuando quieras desde Configuración → Integraciones.
          </p>
        </div>
      </main>
    </div>
  );
}
