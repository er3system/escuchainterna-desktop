'use client';

import { useState, useTransition } from 'react';
import { BellRing, PencilLine, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_PAYMENT_REMINDER_BODY,
  PAYMENT_REMINDER_PLACEHOLDERS,
} from '@/contexts/billing/domain/value-objects/paymentReminderTemplate';
import { Switch } from '@/components/Switch';
import { setAutoPaymentRemindersAction, updatePaymentReminderTemplateAction } from './actions';

/**
 * Switch de recordatorios de pago automáticos (v2-spec §6.13): rediseñado con
 * etiqueta + descripción y botón «Editar recordatorio» que edita el CONTENIDO
 * de la plantilla `recordatorio_pago` del profesional (el nombre no cambia).
 */
export function AutoRemindersToggle({
  initialEnabled,
  templateName,
  templateBody,
}: {
  initialEnabled: boolean;
  templateName: string;
  templateBody: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setEnabled(next);
    startTransition(async () => {
      const result = await setAutoPaymentRemindersAction(next);
      if (!result.ok) setEnabled(!next);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          enabled ? 'bg-primary-light text-primary' : 'bg-bg text-ink-soft'
        }`}
      >
        <BellRing size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Recordatorios de pago automáticos</p>
        <p className="text-xs text-ink-soft">
          {enabled
            ? 'Las sesiones con pago pendiente reciben un recordatorio por WhatsApp.'
            : 'Desactivados: nadie recibirá recordatorios de pago.'}
        </p>
      </div>
      <Switch
        checked={enabled}
        onChange={toggle}
        disabled={pending}
        label="Recordatorios de pago automáticos"
      />
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-bg hover:text-ink"
      >
        <PencilLine size={13} /> Editar recordatorio
      </button>

      {editorOpen ? (
        <ReminderTemplateEditor
          templateName={templateName}
          templateBody={templateBody}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ReminderTemplateEditor({
  templateName,
  templateBody,
  onClose,
}: {
  templateName: string;
  templateBody: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState(templateBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updatePaymentReminderTemplateAction({ body });
      if (!result.ok) {
        setError(result.error ?? 'No se pudo guardar la plantilla.');
        return;
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-card bg-surface p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Editar recordatorio de pago</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-ink-soft hover:bg-bg"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Plantilla <span className="font-medium text-ink">«{templateName}»</span> — puedes cambiar el
          contenido; el nombre de la plantilla es fijo.
        </p>

        {error ? (
          <div className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
        ) : null}

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={12}
          className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
          aria-label="Contenido del recordatorio de pago"
        />

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Variables:</span>
          {PAYMENT_REMINDER_PLACEHOLDERS.map(({ token, description }) => (
            <button
              key={token}
              type="button"
              title={description}
              onClick={() => setBody((prev) => `${prev}{{${token}}}`)}
              className="rounded-full bg-primary-light px-2 py-0.5 font-mono text-xs text-primary hover:bg-primary hover:text-white"
            >
              {`{{${token}}}`}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setBody(DEFAULT_PAYMENT_REMINDER_BODY)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-soft hover:bg-bg"
          >
            <RotateCcw size={13} /> Restaurar original
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Guardar plantilla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
