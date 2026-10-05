'use client';

import { useState, useTransition } from 'react';
import { MailWarning } from 'lucide-react';
import { resendEmailVerificationAction } from '@/app/(app)/configuracion/seguridad/verificacionActions';

/**
 * Aviso NO bloqueante (doble opt-in): se muestra mientras el correo no esté
 * verificado. Permite reenviar el enlace. CLIENTE puro: solo invoca la server
 * action; NO importa casos de uso / repos / dominio-con-crypto (trampa de bundling).
 */
export function EmailVerificationBanner() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleResend() {
    setSent(false);
    startTransition(async () => {
      await resendEmailVerificationAction();
      setSent(true);
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning bg-warning-soft px-4 py-2.5">
      <p className="flex items-center gap-2 text-sm text-warning">
        <MailWarning size={16} className="shrink-0" aria-hidden="true" />
        <span>
          <strong>Confirma tu correo electrónico</strong> — te enviamos un enlace para verificarlo.
          {sent ? <span className="text-warning/80"> Listo, reenviamos el enlace.</span> : null}
        </span>
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-full bg-warning px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-warning/90 disabled:opacity-60"
      >
        {isPending ? 'Enviando…' : sent ? 'Reenviado' : 'Reenviar'}
      </button>
    </div>
  );
}
