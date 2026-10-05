import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone } from 'lucide-react';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { ANNOUNCEMENT_AUDIENCE_LABELS } from '@/contexts/notifications/domain/Announcement';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { AnnouncementForm } from './AnnouncementForm';
import { DeleteAnnouncementButton } from './DeleteAnnouncementButton';

export const metadata = { title: 'Novedades · Administración · EscuchaInterna' };

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "d 'de' MMMM 'de' yyyy, HH:mm 'h'", { locale: es });
}

export default async function AdminNovedadesPage() {
  await requireAdmin();
  const announcements = await createNotificationUseCases().listAnnouncements();

  return (
    <div>
      <PageHeader
        title="Novedades"
        subtitle="Publica anuncios de la plataforma: cada usuario de la audiencia los recibe en su campana de notificaciones."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-base font-bold text-ink">Nueva novedad</h2>
          <AnnouncementForm />
        </div>

        <div className="space-y-3 lg:col-span-2">
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
              <p className="text-base font-semibold text-ink">Sin novedades publicadas</p>
              <p className="mt-1 max-w-md text-sm text-ink-soft">
                Publica la primera: aparecerá en la campana de los usuarios de la audiencia elegida.
              </p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Megaphone size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{announcement.title}</p>
                    <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                      {ANNOUNCEMENT_AUDIENCE_LABELS[announcement.audience]}
                    </span>
                  </div>
                  {announcement.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{announcement.body}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-ink-soft">{formatWhen(announcement.createdAt)}</p>
                </div>
                <DeleteAnnouncementButton id={announcement.id} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
