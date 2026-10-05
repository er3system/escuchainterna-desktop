/**
 * Bitácora de acciones del hub de administración (tabla admin_audit_log).
 * TODA mutación hecha por el admin debe registrarse aquí.
 */

export interface AdminAuditEntry {
  id: string;
  actorUserId: string;
  /** Correo del actor (join con users; '' si la cuenta ya no existe). */
  actorEmail: string;
  action: string;
  target: string;
  detailsJson: string;
  createdAt: string;
}

export interface AdminAuditRecordInput {
  actorUserId: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}

export interface AdminAuditSearchFilters {
  /** Acción exacta (p. ej. 'crear_usuario'); vacío = todas. */
  action?: string;
  /** Coincidencia parcial sobre el correo del actor. */
  actorEmail?: string;
  /** Fecha mínima (yyyy-MM-dd, inclusive). */
  from?: string;
  /** Fecha máxima (yyyy-MM-dd, inclusive). */
  to?: string;
  limit?: number;
}

export interface AdminAuditLogRepository {
  record(input: AdminAuditRecordInput): Promise<void>;
  search(filters: AdminAuditSearchFilters): Promise<AdminAuditEntry[]>;
  /** Acciones distintas registradas (para el filtro de la UI). */
  distinctActions(): Promise<string[]>;
}
