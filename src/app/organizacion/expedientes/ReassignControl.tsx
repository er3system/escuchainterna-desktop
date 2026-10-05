'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { reassignPatientAction } from '../actions';
import { RETAIN_IN_INSTITUTION } from './constants';

/**
 * Control de reasignación de un expediente institucional (§3.3): elige el nuevo
 * tratante o "Retener en la institución" y confirma. Reusa reassignPatientAction.
 */
export function ReassignControl({
  patientId,
  currentOwnerUserId,
  heldByInstitution,
  members,
}: {
  patientId: string;
  currentOwnerUserId: string;
  heldByInstitution: boolean;
  members: Array<{ userId: string; label: string }>;
}) {
  // Valor actual: institución si está retenido, si no el tratante actual (owner).
  const initial = heldByInstitution ? RETAIN_IN_INSTITUTION : currentOwnerUserId;
  const [target, setTarget] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = target !== initial;

  const submit = () => {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await reassignPatientAction(patientId, target);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={target}
        onChange={(event) => {
          setTarget(event.target.value);
          setDone(false);
        }}
        disabled={pending}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
        aria-label="Nuevo tratante"
      >
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.label}
          </option>
        ))}
        <option value={RETAIN_IN_INSTITUTION}>Retener en la institución</option>
      </select>
      <Button
        type="button"
        size="sm"
        onClick={submit}
        disabled={pending || !changed}
        className="text-sm disabled:opacity-50"
      >
        {pending ? 'Reasignando…' : 'Reasignar'}
      </Button>
      {done ? <span className="text-xs font-medium text-success">Reasignado</span> : null}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
    </div>
  );
}
