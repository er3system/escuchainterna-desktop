import { Patient } from '../Patient';

/** Estado de archivo del paciente para el filtro de la lista. */
export type PatientArchivedFilter = 'activos' | 'archivados' | 'todos';

/** Presencia de un diagnóstico activo (join a diagnoses status='activo'). */
export type PatientDiagnosisFilter = 'con' | 'sin' | 'todos';

/**
 * Antigüedad de la última sesión efectiva del paciente con el dueño
 * (bookings no canceladas con start_at en el pasado). Útil para reactivación.
 */
export type PatientLastSessionFilter = 'sin' | 'mas_3_meses' | 'mas_6_meses' | 'este_mes' | 'todos';

/** Existencia de una próxima cita (booking futura no cancelada). */
export type PatientNextAppointmentFilter = 'con' | 'sin' | 'todos';

export interface PatientSearchCriteria {
  /** Texto libre: coincide con nombre, correo, teléfono, etiquetas o número de documento. */
  text: string;
  /** @deprecated usar `archived`; se conserva por compatibilidad. */
  includeArchived: boolean;
  /** Estado de archivo: activos (por defecto), archivados o todos. */
  archived: PatientArchivedFilter;
  /** Etiqueta exacta que debe tener el paciente (de su tags_json). */
  tag: string | null;
  /** Género exacto del paciente (femenino | masculino | otro | …) o null. */
  gender: string | null;
  /** Filtro por diagnóstico activo. */
  diagnosis: PatientDiagnosisFilter;
  /** Filtro por antigüedad de la última sesión. */
  lastSession: PatientLastSessionFilter;
  /** Filtro por próxima cita agendada. */
  nextAppointment: PatientNextAppointmentFilter;
}

export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: string): Promise<Patient | null>;
  search(criteria: PatientSearchCriteria): Promise<Patient[]>;
  /** Etiquetas distintas usadas por los pacientes del dueño (para el panel de filtros). */
  distinctTags(): Promise<string[]>;
}
