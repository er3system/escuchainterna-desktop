'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Building2, CalendarPlus, Loader2, UserRound } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { NewBookingModal } from '../agenda/NewBookingModal';
import {
  getReceptionProfessionalContextAction,
  getReceptionAvailableSlotsAction,
  createReceptionBookingAction,
} from './actions';
import type { ProfessionalBookingContext, ReceptionConsultorioGroup } from './recepcionData';

interface ActiveTarget {
  id: string;
  name: string;
  context: ProfessionalBookingContext;
}

/**
 * Lista los consultorios/profesionales de la recepción y permite AGENDAR para cada
 * profesional: al pulsar "Agendar" carga el contexto del profesional (validado en el
 * servidor) y abre el mismo modal de la agenda, pero con las acciones acotadas a ese
 * profesional (booking + cupos ligados a su id, revalidados server-side).
 */
export function ReceptionScheduler({ groups }: { groups: ReceptionConsultorioGroup[] }) {
  const router = useRouter();
  const [active, setActive] = useState<ActiveTarget | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const openScheduler = (professionalUserId: string, name: string) => {
    setError(null);
    setLoadingId(professionalUserId);
    startTransition(async () => {
      const result = await getReceptionProfessionalContextAction(professionalUserId);
      setLoadingId(null);
      if (result.error || !result.context) {
        setError(result.error ?? 'No se pudo abrir la agenda del profesional.');
        return;
      }
      setActive({ id: professionalUserId, name, context: result.context });
    });
  };

  return (
    <>
      {error ? (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
        {groups.map((group) => (
          <Card key={group.consultorioId}>
            <div className="mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <h2 className="text-sm font-bold text-ink">{group.consultorioName}</h2>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                {group.professionals.length}
              </span>
            </div>
            {group.professionals.length === 0 ? (
              <p className="text-sm text-ink-soft">Este consultorio aún no tiene profesionales que atiendan.</p>
            ) : (
              <ul className="divide-y divide-line">
                {group.professionals.map((professional) => (
                  <li key={professional.userId} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-ink-soft">
                      <UserRound size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{professional.fullName}</p>
                      <p className="truncate text-xs text-ink-soft">{professional.email}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openScheduler(professional.userId, professional.fullName)}
                      disabled={loadingId === professional.userId}
                      className="shrink-0"
                    >
                      {loadingId === professional.userId ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CalendarPlus size={13} />
                      )}
                      Agendar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {active ? (
        <NewBookingModal
          agendas={active.context.agendas}
          patients={active.context.patients}
          currency={active.context.currency}
          consultorios={active.context.consultorios}
          defaultDate={format(new Date(), 'yyyy-MM-dd')}
          createBooking={createReceptionBookingAction.bind(null, active.id)}
          getSlots={getReceptionAvailableSlotsAction.bind(null, active.id)}
          onClose={() => setActive(null)}
          onCreated={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
