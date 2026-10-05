import type { ReportSignatureRequest } from '../ReportSignatureRequest';

/**
 * Repositorio de solicitudes de co-firma. A diferencia de los repos clínicos NO se
 * acota a un único `ownerUserId` en el constructor: es un artefacto ENTRE dos partes
 * (practicante y supervisor), así que cada consulta nombra explícitamente a la parte
 * relevante (el supervisor para su bandeja; el reporte/requester para el estado).
 */
export interface ReportSignatureRequestRepository {
  save(request: ReportSignatureRequest): Promise<void>;
  findById(id: string): Promise<ReportSignatureRequest | null>;
  /** Solicitud PENDIENTE para un reporte (o null). Evita duplicados y alimenta el editor. */
  findPendingByReport(reportId: string): Promise<ReportSignatureRequest | null>;
  /** Solicitudes pendientes dirigidas a un supervisor (su bandeja). */
  listPendingForSupervisor(supervisorUserId: string): Promise<ReportSignatureRequest[]>;
}
