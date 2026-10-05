'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlarmClock,
  Bell,
  Building2,
  CheckCheck,
  GraduationCap,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationItem, NotificationKind } from '@/contexts/notifications/domain/Notification';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationsAction,
} from '@/app/(app)/notificaciones/actions';

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  novedad: Megaphone,
  recordatorio: AlarmClock,
  aviso_org: Building2,
  supervision: GraduationCap,
};

function relativeTime(item: NotificationItem): string {
  const reference = item.remindAt ?? item.createdAt;
  const date = new Date(reference);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

/**
 * Campana de notificaciones (v3 §12): contador de no leídas, panel con las
 * recientes, "Marcar todas como leídas" y acceso a /notificaciones. El feed
 * se carga al abrir (ahí ocurre el fan-out perezoso de novedades).
 */
export function NotificationsBell({
  initialUnread = 0,
  align = 'left',
}: {
  initialUnread?: number;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const feed = await openNotificationsAction();
      setItems(feed.items);
      setUnread(feed.unread);
    } finally {
      setLoading(false);
    }
  }

  function markAll() {
    setUnread(0);
    setItems((current) =>
      current ? current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) : current,
    );
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function openItem(item: NotificationItem) {
    if (!item.readAt) {
      setUnread((count) => Math.max(0, count - 1));
      setItems((current) =>
        current
          ? current.map((existing) =>
              existing.id === item.id ? { ...existing, readAt: new Date().toISOString() } : existing,
            )
          : current,
      );
      startTransition(async () => {
        await markNotificationReadAction(item.id);
      });
    }
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-soft transition-colors hover:bg-bg hover:text-ink"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Velo transparente para cerrar al hacer click fuera */}
          <div className="fixed inset-0 z-[65]" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-[70] mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-card border border-line bg-surface shadow-card ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-sm font-bold text-ink">Notificaciones</p>
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-accent-2"
              >
                <CheckCheck size={13} /> Marcar todas como leídas
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && items === null ? (
                <p className="px-4 py-6 text-center text-sm text-ink-soft">Cargando…</p>
              ) : !items || items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-soft">
                  Sin notificaciones por ahora.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((item) => {
                    const Icon = KIND_ICONS[item.kind];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg ${
                            item.readAt ? 'opacity-70' : ''
                          }`}
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                            <Icon size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {item.title}
                            </span>
                            {item.body ? (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">
                                {item.body}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block text-[11px] text-ink-soft">
                              {relativeTime(item)}
                            </span>
                          </span>
                          {!item.readAt ? (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-line px-4 py-2.5 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push('/notificaciones');
                }}
                className="text-xs font-semibold text-primary hover:underline dark:text-accent-2"
              >
                Ver todas las notificaciones
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
