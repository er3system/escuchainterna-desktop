/**
 * Read model del panel de organización (/organizacion): SOLO números
 * agregados del equipo (counts/sums por mes). Por privacidad JAMÁS expone
 * contenido clínico — ni títulos de notas, ni nombres de pacientes.
 */

/** Comparación mes en curso vs mes anterior de un conteo. */
export interface OrgKpiComparison {
  current: number;
  previous: number;
}

/** Tasa porcentual (0–100) del mes vs mes anterior; null = sin datos para calcularla. */
export interface OrgRateComparison {
  current: number | null;
  previous: number | null;
}

/** Ingresos cobrados en UNA divisa: mes en curso vs mes anterior. */
export interface OrgIncomeByCurrency {
  currency: string;
  current: number;
  previous: number;
}

/** Punto mensual de actividad del equipo (12 meses). */
export interface OrgActivityPoint {
  /** Mes en formato AAAA-MM. */
  month: string;
  /** Sesiones del mes (todas menos canceladas). */
  sessions: number;
  /** Sesiones marcadas como completadas. */
  completed: number;
}

/** Sesiones del mes en curso por miembro (solo nombre + número). */
export interface OrgMemberSessionsPoint {
  memberName: string;
  sessions: number;
}

/** Distribución de estados de sesión del mes en curso. */
export interface OrgSessionStatusBreakdown {
  completadas: number;
  agendadas: number;
  canceladas: number;
  inasistencias: number;
}

/** Punto mensual de supervisión: notas escritas vs notas revisadas. */
export interface OrgSupervisionActivityPoint {
  month: string;
  notesWritten: number;
  notesReviewed: number;
}

export interface OrganizationInsights {
  /** Mes en curso en formato AAAA-MM. */
  month: string;
  /** Miembros con cuenta activa (mes anterior: aproximado por fecha de alta). */
  activeMembers: OrgKpiComparison;
  /** Pacientes no archivados del equipo (mes anterior: por fecha de creación). */
  teamPatients: OrgKpiComparison;
  /** Sesiones completadas en el mes. */
  sessionsHeld: OrgKpiComparison;
  /** % de asistencia del mes: completadas / (completadas + inasistencias). */
  attendanceRate: OrgRateComparison;
  /** % de pacientes activos con consentimiento firmado (digital o en papel). */
  consentRate: OrgRateComparison;
  /** Pacientes con consentimiento firmado (conteo que acompaña a consentRate). */
  patientsWithConsent: number;
  /** Ingresos cobrados en el mes, un renglón por divisa. */
  incomeByCurrency: OrgIncomeByCurrency[];
  activityLast12Months: OrgActivityPoint[];
  sessionsByMember: OrgMemberSessionsPoint[];
  sessionStatus: OrgSessionStatusBreakdown;
  supervisionActivity: OrgSupervisionActivityPoint[];
}

export interface OrganizationInsightsReader {
  read(organizationId: string, now?: Date): Promise<OrganizationInsights>;
}
