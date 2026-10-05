'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui';
import { createBlockedSlotAction } from './actions';
import { BTN_OUTLINE, BTN_PRIMARY, FieldLabel, Modal } from './Modal';

/**
 * Bloquear un espacio de la agenda que NO es un paciente (almuerzo puntual,
 * cita personal, pendiente). Tapa la disponibilidad pública de todas las
 * agendas del profesional en ese rango.
 */
export function BlockSlotModal({
  defaultDate,
  defaultStart,
  defaultEnd,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  /** Horas 'HH:mm' prellenadas (p. ej. al crear desde el arrastre en el Día). */
  defaultStart?: string;
  defaultEnd?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState(defaultStart ?? '13:00');
  const [end, setEnd] = useState(defaultEnd ?? '14:00');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = date !== '' && start !== '' && end !== '' && start < end;

  const submit = () => {
    if (!valid) {
      setError('Revisa la fecha y que la hora de fin sea posterior a la de inicio.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createBlockedSlotAction({ date, start, end, title: title.trim() || undefined });
      if (!result.ok) {
        setError(result.error ?? 'No se pudo bloquear el espacio.');
        return;
      }
      onCreated();
      onClose();
    });
  };

  return (
    <Modal title="Bloquear un espacio" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">
          Reserva un rato que no quieres que te agenden (un almuerzo, una cita personal, un
          pendiente). No es un paciente y no envía mensajes; solo deja de ofrecerse en tu agenda
          pública.
        </p>
        <label className="block">
          <FieldLabel required>Fecha</FieldLabel>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <FieldLabel required>Desde</FieldLabel>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <FieldLabel required>Hasta</FieldLabel>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <FieldLabel>Motivo (opcional)</FieldLabel>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Almuerzo, cita médica, pendiente…"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_OUTLINE}>
            Cancelar
          </button>
          <button type="button" disabled={pending || !valid} onClick={submit} className={BTN_PRIMARY}>
            {pending ? 'Bloqueando…' : 'Bloquear espacio'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
