'use client';

import { useState } from 'react';
import { Check, Copy, Gift, HelpCircle, X } from 'lucide-react';

/**
 * Card del programa de referidos (v3 §11): link para compartir con botón de
 * copiar y modal "¿Cómo funciona?" de 3 pasos.
 */
export function ReferralCard({
  link,
  code,
  registeredCount,
  activeCount,
  discountPercent,
  programPercent,
  maxPercent,
  maxMonths,
}: {
  link: string;
  code: string;
  registeredCount: number;
  activeCount: number;
  discountPercent: number;
  programPercent: number;
  maxPercent: number;
  maxMonths: number;
}) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin permisos de portapapeles: el usuario puede seleccionar el texto.
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
          <Gift size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-ink">Programa de referidos</h2>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-accent-2 hover:underline"
            >
              <HelpCircle size={13} /> ¿Cómo funciona?
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Gana 1 mes de descuento del {programPercent}% por cada colega que se suscriba (hasta{' '}
            {maxPercent}% y {maxMonths} meses).
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink">
              {link}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                copied
                  ? 'bg-success-soft text-success'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full border border-line bg-bg px-3 py-1 text-ink-soft">
              Código: <span className="font-mono font-semibold text-ink">{code}</span>
            </span>
            <span className="rounded-full bg-primary-light px-3 py-1 text-primary">
              {registeredCount} registrado{registeredCount === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-success-soft px-3 py-1 text-success">
              {activeCount} activo{activeCount === 1 ? '' : 's'}
            </span>
            {discountPercent > 0 ? (
              <span className="rounded-full bg-warning-soft px-3 py-1 text-warning">
                Descuento vigente: −{discountPercent}%
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {showHelp ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo funciona el programa de referidos"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">¿Cómo funciona?</h3>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-ink-soft hover:bg-bg hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            <ol className="space-y-4">
              {[
                'Comparte tu link con colegas psicólogos y psicólogas.',
                'Tu colega se registra con tu link e inicia su prueba gratuita.',
                `Cuando realice su primer pago, comienza tu descuento del ${programPercent}% (acumulable hasta ${maxPercent}%, por hasta ${maxMonths} meses).`,
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm text-ink">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
