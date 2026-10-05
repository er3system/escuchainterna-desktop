/**
 * Novedades de plataforma publicadas por el admin (v3 §12): se materializan
 * como notificaciones con fan-out PEREZOSO al abrir la campana de cada usuario.
 * Módulo puro de tipos.
 */

export type AnnouncementAudience = 'todos' | 'psicologos' | 'organizaciones';

export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = [
  'todos',
  'psicologos',
  'organizaciones',
];

export function isAnnouncementAudience(value: string): value is AnnouncementAudience {
  return (ANNOUNCEMENT_AUDIENCES as string[]).includes(value);
}

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  todos: 'Todos los usuarios',
  psicologos: 'Psicólogos/as',
  organizaciones: 'Organizaciones (maestros, profesores y miembros)',
};

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  createdBy: string;
  createdAt: string;
}
