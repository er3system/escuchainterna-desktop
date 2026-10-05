'use client';

import { useState, useTransition } from 'react';
import { MessageCircle, Mail } from 'lucide-react';
import { updateReminderPrefsAction } from './actions';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function ReminderPrefs({
  patientId,
  initialWhatsapp,
  initialEmail,
  hasPhone,
}: {
  patientId: string;
  initialWhatsapp: boolean;
  initialEmail: boolean;
  hasPhone: boolean;
}) {
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [email, setEmail] = useState(initialEmail);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function persist(next: { whatsapp: boolean; email: boolean }) {
    startTransition(async () => {
      const result = await updateReminderPrefsAction(patientId, next.whatsapp, next.email);
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar.');
        // Revertir el estado optimista ante error.
        setWhatsapp(initialWhatsapp);
        setEmail(initialEmail);
      } else {
        setError(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Row
        icon={<MessageCircle size={18} className="text-success" />}
        title="Recordatorios por WhatsApp"
        description={
          hasPhone
            ? 'Confirmaciones y recordatorios de sesión y de pago por WhatsApp.'
            : 'Este paciente no tiene un celular válido; aunque esté activo, no le llegará por WhatsApp.'
        }
      >
        <Toggle
          checked={whatsapp}
          disabled={pending}
          onChange={(next) => {
            setWhatsapp(next);
            persist({ whatsapp: next, email });
          }}
        />
      </Row>
      <Row
        icon={<Mail size={18} className="text-primary" />}
        title="Recordatorios por correo"
        description="Los mismos recordatorios, enviados al correo del paciente."
      >
        <Toggle
          checked={email}
          disabled={pending}
          onChange={(next) => {
            setEmail(next);
            persist({ whatsapp, email: next });
          }}
        />
      </Row>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-ink-soft">
        Afecta solo a los recordatorios de sesión y de pago. Los avisos de cambio o cancelación de
        cita siempre se envían.
      </p>
    </div>
  );
}

function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-bg/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-ink-soft">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
