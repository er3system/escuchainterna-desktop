'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign } from 'lucide-react';
import { toggleBookingPaymentAction } from './actions';

/**
 * Icono $ que alterna pagada/pendiente (spec v2 §6.14) usando los casos de
 * uso de billing: queda sincronizado con /pagos, la pestaña Pagos e /inicio.
 */
export function PaymentToggleButton({
  bookingId,
  patientId,
  paid,
}: {
  bookingId: string;
  patientId: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleBookingPaymentAction(bookingId, patientId, !paid);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo cambiar el estado de pago.');
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={paid ? 'Pagada — clic para marcar pendiente' : 'Pendiente — clic para marcar pagada'}
        aria-label={paid ? 'Marcar como pendiente de pago' : 'Marcar como pagada'}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${
          paid
            ? 'border-success bg-success-soft text-success hover:opacity-80'
            : 'border-line bg-surface text-ink-soft hover:border-warning hover:bg-warning-soft hover:text-warning'
        }`}
      >
        <DollarSign size={15} />
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
