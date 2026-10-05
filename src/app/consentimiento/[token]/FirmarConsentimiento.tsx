'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, PenLine } from 'lucide-react';
import { firmarConsentimientoAction } from './actions';

/**
 * Formulario público de firma: nombre completo + casilla de aceptación.
 * Móvil-primero: campos grandes, un solo paso, confirmación clara.
 */
export function FirmarConsentimiento({ token, minor = false }: { token: string; minor?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ name: string } | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await firmarConsentimientoAction(token, formData);
      if (result.ok) setSigned({ name: result.signedName ?? '' });
      else setError(result.error ?? 'No se pudo registrar la firma.');
    });
  }

  if (signed) {
    return (
      <div className="rounded-card border border-line bg-success-soft p-6 text-center">
        <CheckCircle2 size={44} className="mx-auto text-success" />
        <p className="mt-3 text-lg font-bold text-ink">¡Consentimiento firmado!</p>
        <p className="mt-1 text-sm text-ink-soft">
          Gracias, {signed.name}. Tu firma quedó registrada con fecha y hora; tu profesional ya
          puede verla. Puedes cerrar esta página o guardarla para tu archivo personal.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <PenLine size={17} className="text-primary" /> Firmar este consentimiento
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        {minor
          ? 'Como representante legal (acudiente), tu nombre completo escrito aquí, junto con la fecha y hora, funciona como tu firma digital en nombre del menor.'
          : 'Tu nombre completo escrito aquí, junto con la fecha y hora, funciona como tu firma digital.'}
      </p>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-ink">
          {minor ? 'Nombre del representante legal:' : 'Nombre completo:'}
        </span>
        <input
          name="nombre"
          required
          minLength={5}
          autoComplete="name"
          placeholder={
            minor ? 'Escribe el nombre y apellido del acudiente' : 'Escribe tu nombre y apellido'
          }
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-3 text-base text-ink outline-none transition focus:border-primary"
        />
      </label>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="acepto"
          value="1"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
        />
        <span>
          {minor ? (
            <>
              Como representante legal del paciente menor de edad, leí y comprendí este documento,
              pude resolver mis dudas y <strong>acepto</strong> de forma libre y voluntaria, en su
              nombre, lo que aquí se describe.
            </>
          ) : (
            <>
              Leí y comprendí este documento, pude resolver mis dudas y <strong>acepto</strong> de
              forma libre y voluntaria lo que aquí se describe.
            </>
          )}
        </span>
      </label>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? 'Registrando firma…' : 'Firmar consentimiento'}
      </button>
    </form>
  );
}
