/**
 * Notificaciones in-app (campana, v3 §12). Módulo PURO de tipos: lo consumen
 * la campana (client component) y los read models del contexto.
 */

export type NotificationKind = 'novedad' | 'recordatorio' | 'aviso_org' | 'supervision';

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'novedad',
  'recordatorio',
  'aviso_org',
  'supervision',
];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as string[]).includes(value);
}

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  novedad: 'Novedad',
  recordatorio: 'Recordatorio',
  aviso_org: 'Aviso de tu organización',
  supervision: 'Supervisión',
};

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Ruta interna opcional ('' = sin link). */
  link: string;
  patientId: string | null;
  /** Recordatorios programados: visibles desde esta fecha (ISO). */
  remindAt: string | null;
  createdBy: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Datos para insertar una notificación nueva. */
export interface NewNotification {
  recipientUserId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  patientId?: string | null;
  remindAt?: string | null;
  createdBy?: string | null;
}
