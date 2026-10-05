'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useTransition } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  confirmTotpAction,
  disableTotpAction,
  startTotpSetupAction,
  type TotpFormState,
} from './actions';

const INITIAL: TotpFormState = {};

const CODE_INPUT_CLASS =
  'w-40 rounded-lg border border-line bg-surface px-3 py-2 text-center text-base tracking-[0.3em] text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light';

function CodeInput({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <input
      type="text"
      name="codigo"
      required
      inputMode="numeric"
      pattern="[0-9]{6}"
      maxLength={6}
      placeholder="000000"
      autoFocus={autoFocus}
      className={CODE_INPUT_CLASS}
    />
  );
}

export function TotpPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pendingSetup, startSetup] = useTransition();
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmState, confirmDispatch, confirming] = useActionState(confirmTotpAction, INITIAL);
  const [disableState, disableDispatch, disabling] = useActionState(disableTotpAction, INITIAL);

  useEffect(() => {
    if (confirmState.ok || disableState.ok) {
      setSetup(null);
      router.refresh();
    }
  }, [confirmState.ok, disableState.ok, router]);

  const begin = () => {
    setSetupError(null);
    startSetup(async () => {
      const result = await startTotpSetupAction();
      if (result.qrDataUrl && result.secret) {
        setSetup({ qrDataUrl: result.qrDataUrl, secret: result.secret });
      } else {
        setSetupError(result.error ?? 'No se pudo iniciar la configuración.');
      }
    });
  };

  const copySecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin clipboard: el código queda visible para copiarlo a mano
    }
  };

  // ============================ 2FA ACTIVO ============================
  if (enabled) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Verificación en dos pasos activa</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Al iniciar sesión, además de tu contraseña se te pedirá un código de tu app de
              autenticación (Google Authenticator, Authy, 1Password…).
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <ShieldOff size={13} /> Desactivar el segundo factor
          </h3>
          <p className="mt-1 text-xs text-ink-soft">
            Para desactivarlo escribe un código vigente de tu app.
          </p>
          <form action={disableDispatch} className="mt-3 flex flex-wrap items-center gap-3">
            <CodeInput />
            <button
              type="submit"
              disabled={disabling}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
            >
              {disabling ? 'Desactivando…' : 'Desactivar 2FA'}
            </button>
          </form>
          {disableState.error ? <p className="mt-2 text-sm text-danger">{disableState.error}</p> : null}
        </div>
      </div>
    );
  }

  // ============================ 2FA INACTIVO ============================
  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Verificación en dos pasos (TOTP)</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Protege los expedientes de tus pacientes con un segundo factor: además de tu contraseña,
            un código temporal de tu app de autenticación. Opcional, pero muy recomendado.
          </p>
        </div>
      </div>

      {!setup ? (
        <div className="mt-4">
          <Button type="button" onClick={begin} disabled={pendingSetup}>
            {pendingSetup ? 'Generando…' : 'Activar verificación en dos pasos'}
          </Button>
          {setupError ? <p className="mt-2 text-sm text-danger">{setupError}</p> : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-start gap-5">
            <img
              src={setup.qrDataUrl}
              alt="Código QR para tu app de autenticación"
              width={180}
              height={180}
              className="rounded-lg border border-line bg-white p-2"
            />
            <div className="min-w-0 flex-1 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-ink">1. Escanea el QR</p>
                <p className="text-xs text-ink-soft">
                  Abre tu app de autenticación y escanea el código. Si no puedes escanear, escribe el
                  código manual:
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-lg bg-bg px-3 py-1.5 font-mono text-xs text-ink">
                    {setup.secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-bg"
                  >
                    {copied ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div>
                <p className="font-semibold text-ink">2. Confirma con un código</p>
                <p className="text-xs text-ink-soft">
                  Escribe el código de 6 dígitos que muestra la app para activar el segundo factor.
                </p>
                <form action={confirmDispatch} className="mt-2 flex flex-wrap items-center gap-3">
                  <CodeInput autoFocus />
                  <Button type="submit" disabled={confirming}>
                    {confirming ? 'Confirmando…' : 'Confirmar y activar'}
                  </Button>
                </form>
                {confirmState.error ? (
                  <p className="mt-2 text-sm text-danger">{confirmState.error}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
