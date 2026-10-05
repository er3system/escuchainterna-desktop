import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';

export const metadata = { title: 'Confirmar correo · EscuchaInterna' };

export default async function VerificarCorreoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { ok } = await createIdentityUseCases().verifyEmail.verify(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <div className="mb-6 flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <p className="text-2xl font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>

        {ok ? (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-left text-sm text-success">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>
                <strong>¡Correo confirmado!</strong> Gracias por verificar tu dirección. Ya puedes
                seguir usando tu cuenta con total normalidad.
              </p>
            </div>
            <Link
              href="/inicio"
              className="mt-4 inline-block w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Ir a mi cuenta
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-left text-sm text-danger">
              <XCircle size={18} className="mt-0.5 shrink-0" />
              <p>
                <strong>Enlace inválido o vencido.</strong> Es posible que ya hayas confirmado tu
                correo o que el enlace haya caducado. Inicia sesión y, si hace falta, vuelve a enviar
                la confirmación desde el aviso superior.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-4 inline-block w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Ir a iniciar sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
