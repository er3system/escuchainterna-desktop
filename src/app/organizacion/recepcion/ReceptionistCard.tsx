'use client';

import { useState } from 'react';
import { Headset, Pencil } from 'lucide-react';
import { Button } from '@/components/ui';
import { setReceptionConsultoriosAction } from '../actions';
import type { OrgConsultorio, OrgReceptionist } from '../orgData';

export function ReceptionistCard({
  reception,
  consultorios,
}: {
  reception: OrgReceptionist;
  consultorios: OrgConsultorio[];
}) {
  const [editing, setEditing] = useState(false);
  const assignedIds = new Set(reception.consultorios.map((c) => c.id));
  const suspended = reception.status !== 'activo';

  return (
    <div className="rounded-card border border-line bg-surface px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Headset size={16} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {reception.fullName}
              {suspended ? (
                <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                  Suspendida
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-ink-soft">{reception.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary"
        >
          <Pencil size={13} /> Consultorios
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {reception.consultorios.length === 0 ? (
          <span className="text-xs text-ink-soft">Sin consultorios vigentes</span>
        ) : (
          reception.consultorios.map((consultorio) => (
            <span
              key={consultorio.id}
              className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {consultorio.name}
            </span>
          ))
        )}
      </div>

      {editing ? (
        <form
          action={setReceptionConsultoriosAction.bind(null, reception.userId)}
          className="mt-3 space-y-2 rounded-lg border border-line bg-bg p-3"
        >
          <p className="text-xs font-medium text-ink-soft">Consultorios que atiende</p>
          <div className="space-y-1.5">
            {consultorios.map((consultorio) => (
              <label key={consultorio.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="consultorioId"
                  value={consultorio.id}
                  defaultChecked={assignedIds.has(consultorio.id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {consultorio.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
            >
              Cancelar
            </button>
            <Button type="submit" size="sm">
              Guardar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
