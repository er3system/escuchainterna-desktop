import { AggregateRoot } from '@/shared/domain/AggregateRoot';

/** Consentimiento del miembro: el caso exige consentimiento DOBLE (uno por persona). */
export type MemberConsentStatus = 'pendiente' | 'otorgado';

/**
 * Resultado del cribado de violencia (terapia-pareja §"cribado de violencia"),
 * que SOLO se hace por separado (en sesión individual): 'violencia_coercitiva'
 * (control coercitivo) contraindica el formato conjunto.
 */
export type ScreeningStatus =
  | 'pendiente'
  | 'sin_hallazgos'
  | 'violencia_situacional'
  | 'violencia_coercitiva';

export interface CaseMemberPrimitives {
  id: string;
  caseId: string;
  patientId: string;
  ownerUserId: string;
  label: string;
  /** Rol / parentesco en el sistema (madre, padre, hijo/a, pareja…); '' si no consta. */
  role: string;
  /** ¿Es el paciente identificado (quien porta el síntoma en el sistema)? */
  isIdentifiedPatient: boolean;
  consentStatus: MemberConsentStatus;
  screeningStatus: ScreeningStatus;
  screeningAt: string | null;
  createdAt: string;
}

/** Miembro de un caso relacional: vincula un paciente al caso con su propio
 * consentimiento y su propio cribado de violencia. */
export class CaseMember extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly caseId: string,
    private readonly patientId: string,
    private readonly ownerUserId: string,
    private label: string,
    private role: string,
    private isIdentifiedPatient: boolean,
    private consentStatus: MemberConsentStatus,
    private screeningStatus: ScreeningStatus,
    private screeningAt: Date | null,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static add(input: {
    id: string;
    caseId: string;
    patientId: string;
    ownerUserId: string;
    label: string;
    role?: string;
  }): CaseMember {
    return new CaseMember(
      input.id,
      input.caseId,
      input.patientId,
      input.ownerUserId,
      input.label.trim(),
      (input.role ?? '').trim(),
      false,
      'pendiente',
      'pendiente',
      null,
      new Date(),
    );
  }

  public static fromPrimitives(primitives: CaseMemberPrimitives): CaseMember {
    return new CaseMember(
      primitives.id,
      primitives.caseId,
      primitives.patientId,
      primitives.ownerUserId,
      primitives.label,
      primitives.role ?? '',
      primitives.isIdentifiedPatient ?? false,
      primitives.consentStatus,
      primitives.screeningStatus,
      primitives.screeningAt ? new Date(primitives.screeningAt) : null,
      new Date(primitives.createdAt),
    );
  }

  /** Fija el rol / parentesco del miembro en el sistema. */
  public setRole(role: string): void {
    this.role = role.trim();
  }

  /** Marca/desmarca a este miembro como el paciente identificado del caso. */
  public setIdentifiedPatient(flag: boolean): void {
    this.isIdentifiedPatient = flag;
  }

  public memberId(): string {
    return this.id;
  }

  public memberPatientId(): string {
    return this.patientId;
  }

  public memberCaseId(): string {
    return this.caseId;
  }

  public grantConsent(): void {
    this.consentStatus = 'otorgado';
  }

  public hasConsent(): boolean {
    return this.consentStatus === 'otorgado';
  }

  /** Registra el resultado del cribado de violencia (hecho por separado). */
  public recordScreening(status: ScreeningStatus): void {
    this.screeningStatus = status;
    this.screeningAt = new Date();
  }

  public screeningDone(): boolean {
    return this.screeningStatus !== 'pendiente';
  }

  /** ¿El cribado revela violencia coercitiva (contraindica el formato conjunto)? */
  public screeningContraindicatesJoint(): boolean {
    return this.screeningStatus === 'violencia_coercitiva';
  }

  public toPrimitives(): CaseMemberPrimitives {
    return {
      id: this.id,
      caseId: this.caseId,
      patientId: this.patientId,
      ownerUserId: this.ownerUserId,
      label: this.label,
      role: this.role,
      isIdentifiedPatient: this.isIdentifiedPatient,
      consentStatus: this.consentStatus,
      screeningStatus: this.screeningStatus,
      screeningAt: this.screeningAt ? this.screeningAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
