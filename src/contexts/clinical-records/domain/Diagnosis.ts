import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { InvalidDiagnosisStatusError } from './errors/InvalidDiagnosisStatusError';

export type DiagnosisStatus = 'activo' | 'descartado' | 'remitido';

export const DIAGNOSIS_STATUSES: DiagnosisStatus[] = ['activo', 'descartado', 'remitido'];

export function parseDiagnosisStatus(value: string): DiagnosisStatus {
  if ((DIAGNOSIS_STATUSES as string[]).includes(value)) return value as DiagnosisStatus;
  throw new InvalidDiagnosisStatusError(value);
}

/**
 * Naturaleza del diagnóstico:
 * - 'hipotesis' = hipótesis diagnóstica de trabajo (por defecto, sin compromiso
 *   clínico-legal); cualquiera que atienda puede registrarla.
 * - 'formal'    = diagnóstico formal; es una AFIRMACIÓN clínico-legal y exige
 *   tarjeta profesional (el gate vive en la capa de aplicación, como la firma).
 */
export type DiagnosisKind = 'hipotesis' | 'formal';

export interface DiagnosisPrimitives {
  id: string;
  patientId: string;
  cie11Code: string;
  cie11Title: string;
  notes: string;
  status: DiagnosisStatus;
  /** Hipótesis diagnóstica vs diagnóstico formal. */
  kind: DiagnosisKind;
  /** Usuario responsable de la afirmación actual (no repudio); '' si no consta. */
  diagnosedByUserId: string;
  diagnosedAt: string;
}

/** Diagnóstico CIE-11 asignado a un paciente. */
export class Diagnosis extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly cie11Code: string,
    private readonly cie11Title: string,
    private notes: string,
    private status: DiagnosisStatus,
    private kind: DiagnosisKind,
    private diagnosedByUserId: string,
    private readonly diagnosedAt: Date,
  ) {
    super();
  }

  public static register(input: {
    id: string;
    patientId: string;
    cie11Code: string;
    cie11Title: string;
    notes: string;
    /** Quién lo registra; queda como responsable de la hipótesis inicial. */
    registeredByUserId?: string;
  }): Diagnosis {
    // Nace SIEMPRE como hipótesis: confirmar uno formal es un acto aparte que exige licencia.
    return new Diagnosis(
      input.id,
      input.patientId,
      input.cie11Code,
      input.cie11Title,
      input.notes,
      'activo',
      'hipotesis',
      input.registeredByUserId ?? '',
      new Date(),
    );
  }

  public static fromPrimitives(primitives: DiagnosisPrimitives): Diagnosis {
    return new Diagnosis(
      primitives.id,
      primitives.patientId,
      primitives.cie11Code,
      primitives.cie11Title,
      primitives.notes,
      primitives.status,
      primitives.kind ?? 'hipotesis',
      primitives.diagnosedByUserId ?? '',
      new Date(primitives.diagnosedAt),
    );
  }

  public changeStatus(status: DiagnosisStatus): void {
    this.status = status;
  }

  public updateNotes(notes: string): void {
    this.notes = notes;
  }

  /**
   * Eleva la hipótesis a diagnóstico FORMAL. La identidad/licencia del responsable la
   * valida la capa de aplicación (un practicante sin tarjeta no puede confirmarlo).
   */
  public confirmAsFormal(input: { confirmedByUserId: string }): void {
    this.kind = 'formal';
    this.diagnosedByUserId = input.confirmedByUserId;
  }

  /** Degrada un diagnóstico a hipótesis (acto conservador: no exige licencia). */
  public revertToHypothesis(): void {
    this.kind = 'hipotesis';
  }

  public diagnosisId(): string {
    return this.id;
  }

  public isFormal(): boolean {
    return this.kind === 'formal';
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public toPrimitives(): DiagnosisPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      cie11Code: this.cie11Code,
      cie11Title: this.cie11Title,
      notes: this.notes,
      status: this.status,
      kind: this.kind,
      diagnosedByUserId: this.diagnosedByUserId,
      diagnosedAt: this.diagnosedAt.toISOString(),
    };
  }
}
