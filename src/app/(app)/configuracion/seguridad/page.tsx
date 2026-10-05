import { Download } from 'lucide-react';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { totpEnabled } from '@/shared/infrastructure/auth/totp';
import { Card, PageHeader } from '@/components/ui';
import { TotpPanel } from './TotpPanel';
import { ChangePasswordPanel } from './ChangePasswordPanel';
import { CloseSessionsPanel } from './CloseSessionsPanel';
import { DeleteAccountPanel } from './DeleteAccountPanel';

export const metadata = { title: 'Seguridad · EscuchaInterna' };

/**
 * Seguridad de la cuenta (v3 §1.3): activación/desactivación opt-in del
 * segundo factor TOTP con QR y código manual.
 */
export default async function SeguridadPage() {
  const userId = await requireSessionUserId();
  const enabled = await totpEnabled(userId);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Seguridad"
        subtitle="Protege tu cuenta y los expedientes de tus pacientes con verificación en dos pasos."
      />
      <TotpPanel enabled={enabled} />

      <div className="mt-4">
        <ChangePasswordPanel />
      </div>

      <div className="mt-4">
        <CloseSessionsPanel />
      </div>

      <div className="mt-4">
        <Card>
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
            <Download size={14} /> Tus datos (habeas data)
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Descarga una copia de todos tus datos en EscuchaInterna en formato JSON: tu cuenta, perfil,
            suscripción y todos los expedientes, sesiones, pagos y mensajes de los que eres dueño (con el
            contenido clínico ya descifrado). Es tu derecho de acceso y portabilidad (Ley 1581).
          </p>
          <a
            href="/api/configuracion/datos"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            <Download size={15} /> Descargar mis datos (JSON)
          </a>
        </Card>
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        Además del segundo factor, EscuchaInterna cifra el contenido clínico en reposo (notas de
        sesión, historias, reportes y chat de IA), registra cada acceso al expediente en una bitácora
        y bloquea el inicio de sesión durante 15 minutos tras 5 intentos fallidos.
      </p>

      <div className="mt-8">
        <DeleteAccountPanel />
      </div>
    </div>
  );
}
