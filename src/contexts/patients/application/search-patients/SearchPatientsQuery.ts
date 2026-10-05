import {
  PatientArchivedFilter,
  PatientDiagnosisFilter,
  PatientLastSessionFilter,
  PatientNextAppointmentFilter,
  PatientSearchCriteria,
} from '../../domain/repositories/PatientRepository';

const ARCHIVED_VALUES: readonly PatientArchivedFilter[] = ['activos', 'archivados', 'todos'];
const DIAGNOSIS_VALUES: readonly PatientDiagnosisFilter[] = ['con', 'sin', 'todos'];
const LAST_SESSION_VALUES: readonly PatientLastSessionFilter[] = [
  'sin',
  'mas_3_meses',
  'mas_6_meses',
  'este_mes',
  'todos',
];
const NEXT_APPOINTMENT_VALUES: readonly PatientNextAppointmentFilter[] = ['con', 'sin', 'todos'];

function oneOf<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  return raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export interface SearchPatientsInput {
  text?: string;
  /** Atajo histórico para el toggle "ver archivados" (activos + archivados). */
  includeArchived?: boolean;
  archived?: string;
  tag?: string;
  gender?: string;
  diagnosis?: string;
  lastSession?: string;
  nextAppointment?: string;
}

export class SearchPatientsQuery {
  private readonly text: string;
  private readonly archived: PatientArchivedFilter;
  private readonly tag: string | null;
  private readonly gender: string | null;
  private readonly diagnosis: PatientDiagnosisFilter;
  private readonly lastSession: PatientLastSessionFilter;
  private readonly nextAppointment: PatientNextAppointmentFilter;

  public constructor(input: SearchPatientsInput) {
    this.text = (input.text ?? '').trim();
    // `archived` explícito gana; si no, el toggle histórico decide activos/todos.
    this.archived =
      input.archived !== undefined
        ? oneOf(input.archived, ARCHIVED_VALUES, 'activos')
        : input.includeArchived
          ? 'todos'
          : 'activos';
    const tag = (input.tag ?? '').trim();
    this.tag = tag.length > 0 ? tag : null;
    const gender = (input.gender ?? '').trim();
    this.gender = gender.length > 0 ? gender : null;
    this.diagnosis = oneOf(input.diagnosis, DIAGNOSIS_VALUES, 'todos');
    this.lastSession = oneOf(input.lastSession, LAST_SESSION_VALUES, 'todos');
    this.nextAppointment = oneOf(input.nextAppointment, NEXT_APPOINTMENT_VALUES, 'todos');
  }

  public toCriteria(): PatientSearchCriteria {
    return {
      text: this.text,
      includeArchived: this.archived !== 'activos',
      archived: this.archived,
      tag: this.tag,
      gender: this.gender,
      diagnosis: this.diagnosis,
      lastSession: this.lastSession,
      nextAppointment: this.nextAppointment,
    };
  }
}
