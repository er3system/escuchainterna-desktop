import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarPlus, ExternalLink, HeartHandshake, Mic } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { ListUpcomingEvents } from '@/contexts/community/application/list-upcoming-events/ListUpcomingEvents';
import { SqliteCommunityEventRepository } from '@/contexts/community/infrastructure/persistence/SqliteCommunityEventRepository';

export default async function ComunidadPage() {
  const events = await new ListUpcomingEvents(new SqliteCommunityEventRepository()).list();

  return (
    <div>
      <PageHeader
        title="Comunidad"
        subtitle="Eventos para colegas: supervisión, talleres y círculos de lectura."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {events.length === 0 ? (
            <EmptyState
              title="Sin eventos próximos"
              description="Cuando se programen nuevos eventos de la comunidad aparecerán aquí."
            />
          ) : (
            events.map((event) => {
              const startsAt = new Date(event.startsAt);
              return (
                <Card key={event.id} className="flex items-start gap-5">
                  {/* Bloque de fecha amarillo pastel (firma visual de Comunidad). El amarillo es
                      FIJO en ambos temas, así que el texto va en oscuro fijo (no en tokens que se
                      aclararían en modo oscuro y quedarían ilegibles sobre el amarillo). */}
                  <div className="flex w-20 shrink-0 flex-col items-center rounded-xl bg-[#F8EFA9] px-3 py-3 text-center">
                    <span className="text-xs lowercase text-[#5c6270]">
                      {format(startsAt, 'EEE', { locale: es })}
                    </span>
                    <span className="text-2xl font-bold text-[#1a1d27]">{format(startsAt, 'd')}</span>
                    <span className="text-xs text-[#5c6270]">{format(startsAt, 'HH:mm')} h</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                      {format(startsAt, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                    <h2 className="mt-0.5 text-base font-bold text-ink">{event.title}</h2>
                    {event.description ? (
                      <p className="mt-1 text-sm text-ink-soft">{event.description}</p>
                    ) : null}
                    {event.speaker ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
                        <Mic size={13} /> {event.speaker}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={`/comunidad/${event.id}/ics`}
                        download
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white"
                      >
                        <CalendarPlus size={14} /> Agregar a mi calendario
                      </a>
                      {event.link ? (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-bg dark:text-accent-2"
                        >
                          <ExternalLink size={14} /> Enlace
                        </a>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Bloque fijo de invitación a la comunidad. */}
        <Card className="h-fit">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
            <HeartHandshake size={18} />
          </span>
          <h2 className="mt-3 text-base font-bold text-ink">Súmate a la comunidad</h2>
          <p className="mt-1 text-sm text-ink-soft">
            La comunidad de EscuchaInterna es un espacio entre colegas para supervisar casos, compartir herramientas
            clínicas y acompañarnos en el ejercicio de la profesión.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            <li>• Supervisión de casos grupal cada mes.</li>
            <li>• Talleres prácticos con invitados.</li>
            <li>• Círculo de lectura de la biblioteca clínica.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            Los eventos son gratuitos. Agrega el que te interese a tu calendario y nos vemos ahí.
          </p>
        </Card>
      </div>
    </div>
  );
}
