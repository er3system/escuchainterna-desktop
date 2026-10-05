import { AggregateRoot } from '@/shared/domain/AggregateRoot';

/**
 * Los tres círculos de visibilidad del contenido de un caso (§10):
 * - 'compartido': sesión conjunta, visible a todo el caso.
 * - 'individual': privado del miembro (su track individual).
 * - 'confidential': privado de esa sesión individual; NUNCA se filtra en el
 *   export del caso ni a la otra persona (requisito de seguridad, no preferencia).
 */
export type CaseSessionVisibility = 'compartido' | 'individual' | 'confidential';

export interface CaseSessionNotePrimitives {
  id: string;
  caseId: string;
  ownerUserId: string;
  /** null = sesión conjunta. */
  memberId: string | null;
  /** Paciente de la sesión individual (null en conjunta). */
  patientId: string | null;
  title: string;
  content: string;
  visibility: CaseSessionVisibility;
  /** Ids de miembro que asistieron (sesión conjunta de subsistema). [] = no especificado. */
  attendees: string[];
  createdAt: string;
  updatedAt: string;
}

/** Sesión de un caso relacional: conjunta (compartida) o individual (privada/confidencial). */
export class CaseSessionNote extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly caseId: string,
    private readonly ownerUserId: string,
    private readonly memberId: string | null,
    private readonly patientId: string | null,
    private title: string,
    private content: string,
    private readonly visibilityValue: CaseSessionVisibility,
    private readonly attendees: string[],
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  /** Sesión conjunta (compartida con todo el caso). `attendees` = miembros presentes. */
  public static joint(input: {
    id: string;
    caseId: string;
    ownerUserId: string;
    title: string;
    content: string;
    attendees?: string[];
  }): CaseSessionNote {
    const now = new Date();
    return new CaseSessionNote(
      input.id,
      input.caseId,
      input.ownerUserId,
      null,
      null,
      input.title.trim() || 'Sesión conjunta',
      input.content,
      'compartido',
      [...new Set((input.attendees ?? []).filter((value) => value.trim() !== ''))],
      now,
      now,
    );
  }

  /** Sesión individual de un miembro: privada ('individual') o 'confidential'. */
  public static individual(input: {
    id: string;
    caseId: string;
    ownerUserId: string;
    memberId: string;
    patientId: string;
    title: string;
    content: string;
    confidential: boolean;
  }): CaseSessionNote {
    const now = new Date();
    return new CaseSessionNote(
      input.id,
      input.caseId,
      input.ownerUserId,
      input.memberId,
      input.patientId,
      input.title.trim() || 'Sesión individual',
      input.content,
      input.confidential ? 'confidential' : 'individual',
      [],
      now,
      now,
    );
  }

  public static fromPrimitives(p: CaseSessionNotePrimitives): CaseSessionNote {
    return new CaseSessionNote(
      p.id,
      p.caseId,
      p.ownerUserId,
      p.memberId,
      p.patientId,
      p.title,
      p.content,
      p.visibility,
      Array.isArray(p.attendees) ? p.attendees : [],
      new Date(p.createdAt),
      new Date(p.updatedAt),
    );
  }

  /** Ids de miembro que asistieron (solo relevante en sesiones conjuntas). */
  public attendeeMemberIds(): string[] {
    return [...this.attendees];
  }

  public noteId(): string {
    return this.id;
  }

  public visibility(): CaseSessionVisibility {
    return this.visibilityValue;
  }

  public isJoint(): boolean {
    return this.visibilityValue === 'compartido';
  }

  public isConfidential(): boolean {
    return this.visibilityValue === 'confidential';
  }

  public ownerPatientId(): string | null {
    return this.patientId;
  }

  /** ¿Es visible para el miembro cuyo paciente es `patientId`? */
  public isVisibleToMemberPatient(patientId: string): boolean {
    if (this.visibilityValue === 'compartido') return true;
    return this.patientId === patientId;
  }

  /**
   * ¿Entra en el export consolidado del caso? Lo 'confidential' NUNCA se incluye
   * (requisito de seguridad §10); lo compartido y lo individual sí (filtrado por
   * miembro en el ensamblado del export, Fase 4d).
   */
  public includedInCaseExport(): boolean {
    return this.visibilityValue !== 'confidential';
  }

  public toPrimitives(): CaseSessionNotePrimitives {
    return {
      id: this.id,
      caseId: this.caseId,
      ownerUserId: this.ownerUserId,
      memberId: this.memberId,
      patientId: this.patientId,
      title: this.title,
      content: this.content,
      visibility: this.visibilityValue,
      attendees: [...this.attendees],
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
