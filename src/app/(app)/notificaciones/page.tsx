import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlarmClock, Building2, CheckCheck, ExternalLink, GraduationCap, Megaphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import {
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
} from '@/contexts/notifications/domain/Notification';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { resolveDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { markAllNotificationsReadAction, markNotificationReadAction } from './actions';
import { NewReminderForm, type ReminderPatientOption } from './NewReminderForm';

export const metadata = { title: 'Notificaciones · EscuchaInterna' };

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  novedad: Megaphone,
  recordatorio: AlarmClock,
  aviso_org: Building2,
  supervision: GraduationCap,
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return format(date, "d 'de' MMMM 'de' yyyy, HH:mm 'h'", { locale: es });
}

/** Pacientes del consultorio para el selector del recordatorio (datos de contacto). */
async function listPatientOptions(ownerUserId: string): Promise<ReminderPatientOption[]> {
  const rows = (await getDatabaseAdapter().query(
    `SELECT id, full_name FROM patients
        WHERE owner_user_id = ? AND archived = 0
        ORDER BY LOWER(full_name)`,
    [ownerUserId],
  )) as unknown as Array<{ id: string; full_name: string }>;
  return rows.map((row) => ({ id: row.id, fullName: row.full_name }));
}

export default async function NotificacionesPage() {
  const userId = await requireSessionUserId();
  const ownerUserId = await resolveDataOwnerUserId(userId);
  const useCases = createNotificationUseCases();
  const feed = await useCases.listNotifications.list(userId, 100);
  const patients = await listPatientOptions(ownerUserId);

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        subtitle="Novedades de la plataforma, tus recordatorios y avisos de tu organización."
        actions={
          feed.unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
              >
                <CheckCheck size={15} /> Marcar todas como leídas ({feed.unread})
              </button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {feed.items.length === 0 ? (
            <EmptyState
              title="Sin notificaciones"
              description="Cuando haya novedades de la plataforma, recordatorios tuyos o avisos de tu organización, aparecerán aquí."
            />
          ) : (
            feed.items.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              const unread = item.readAt === null;
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-card border bg-surface p-4 shadow-card ${
                    unread ? 'border-primary/40' : 'border-line opacity-80'
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                        {NOTIFICATION_KIND_LABELS[item.kind]}
                      </span>
                      {unread ? (
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      ) : null}
                    </div>
                    {item.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{item.body}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {formatWhen(item.remindAt ?? item.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {item.link ? (
                        <Link
                          href={item.link}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-accent-2 hover:underline"
                        >
                          <ExternalLink size={12} /> Abrir
                        </Link>
                      ) : null}
                      {unread ? (
                        <form action={markNotificationReadAction.bind(null, item.id)}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-ink-soft hover:text-ink hover:underline"
                          >
                            Marcar como leída
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <AlarmClock size={17} className="text-primary dark:text-accent-2" />
              <h2 className="text-base font-bold text-ink">Nuevo recordatorio</h2>
            </div>
            <p className="mb-4 text-xs text-ink-soft">
              Crea recordatorios para ti (y para el profesional titular, si eres asistente): llamadas,
              seguimientos, tareas pendientes. Aparecen en la campana desde la fecha indicada.
            </p>
            <NewReminderForm patients={patients} searchable />
          </Card>
        </div>
      </div>
    </div>
  );
}
