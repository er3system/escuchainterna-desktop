import type { AdminAuditEntry } from './AdminAuditLogRepository';

/**
 * Read model del dashboard de administración: SOLO agregados SQL
 * (counts/sums). Por privacidad JAMÁS expone contenido clínico.
 */

export interface AdminDashboardUsers {
  total: number;
  active: number;
  suspended: number;
}

export interface AdminDashboardTrials {
  /** Suscripciones en trial todavía vigente. */
  active: number;
  /** Trials vigentes que vencen dentro de los próximos 7 días. */
  expiringSoon: number;
}

export interface AdminDashboardSubscriptions {
  active: number;
  /** MRR simulado en modo local: suscripciones activas × precio del plan. */
  mrr: number;
}

export interface AdminDashboardTotals {
  patients: number;
  bookings: number;
  outboxMessages: number;
}

export interface RegistrationsPoint {
  /** Día en formato yyyy-MM-dd. */
  day: string;
  count: number;
}

export interface AdminDashboard {
  users: AdminDashboardUsers;
  trials: AdminDashboardTrials;
  subscriptions: AdminDashboardSubscriptions;
  organizations: number;
  totals: AdminDashboardTotals;
  /** Serie completa (30 puntos) de registros por día, incluidos los días en cero. */
  registrationsLast30Days: RegistrationsPoint[];
  databaseSizeBytes: number;
  recentAuditEntries: AdminAuditEntry[];
}

export interface AdminDashboardReader {
  read(now?: Date): Promise<AdminDashboard>;
}
