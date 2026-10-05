import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { ConsentAlreadySignedError } from './errors/ConsentAlreadySignedError';
import { ConsentLinkRevokedError } from './errors/ConsentLinkRevokedError';
import { InvalidConsentSignatureError } from './errors/InvalidConsentSignatureError';
import {
  isConsentGranted,
  type ConsentSignatureKind,
  type ConsentStatus,
} from './value-objects/consentStatus';

export interface PatientConsentPrimitives {
  id: string;
  patientId: string;
  token: string;
  templateTitle: string;
  templateBody: string;
  status: ConsentStatus;
  sentAt: string | null;
  signedAt: string | null;
  signedName: string;
  signatureKind: ConsentSignatureKind;
  filePath: string | null;
  createdAt: string;
  /** Fecha de revocación (Ley 1581): null = vigente / no revocado. */
  revokedAt?: string | null;
  /**
   * Finalidad-IA: ¿el cuerpo firmado incluye la cláusula que autoriza el procesamiento por
   * inteligencia artificial? Se congela al emitir (según el snapshot del cuerpo). El asistente
   * solo recibe el contexto del paciente si su consentimiento OTORGADO y vigente la tiene en true.
   */
  aiAuthorized?: boolean;
}

/**
 * Consentimiento informado emitido a UN paciente (v3 §2): snapshot de la
 * plantilla + token único para la página pública de firma. Estados:
 * pendiente → firmado (digital) | papel_adjunto (foto/escaneo) | revocado.
 */
export class PatientConsent extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly token: string,
    private readonly templateTitle: string,
    private readonly templateBody: string,
    private status: ConsentStatus,
    private sentAt: Date | null,
    private signedAt: Date | null,
    private signedName: string,
    private signatureKind: ConsentSignatureKind,
    private filePath: string | null,
    private readonly createdAt: Date,
    private revokedAt: Date | null,
    private readonly aiAuthorized: boolean = false,
  ) {
    super();
  }

  /** Emite la liga de firma con el snapshot de la plantilla ya resuelto (salvo {{fecha}}). */
  public static issue(input: {
    id: string;
    patientId: string;
    token: string;
    templateTitle: string;
    templateBody: string;
    /** ¿El snapshot del cuerpo incluye la cláusula de finalidad-IA? (lo computa el caso de uso). */
    aiAuthorized?: boolean;
  }): PatientConsent {
    const now = new Date();
    return new PatientConsent(
      input.id,
      input.patientId,
      input.token,
      input.templateTitle,
      input.templateBody,
      'pendiente',
      now,
      null,
      '',
      '',
      null,
      now,
      null,
      input.aiAuthorized ?? false,
    );
  }

  public static fromPrimitives(primitives: PatientConsentPrimitives): PatientConsent {
    return new PatientConsent(
      primitives.id,
      primitives.patientId,
      primitives.token,
      primitives.templateTitle,
      primitives.templateBody,
      primitives.status,
      primitives.sentAt ? new Date(primitives.sentAt) : null,
      primitives.signedAt ? new Date(primitives.signedAt) : null,
      primitives.signedName,
      primitives.signatureKind,
      primitives.filePath,
      new Date(primitives.createdAt),
      primitives.revokedAt ? new Date(primitives.revokedAt) : null,
      primitives.aiAuthorized ?? false,
    );
  }

  public consentId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public isGranted(): boolean {
    return isConsentGranted(this.status);
  }

  public isPending(): boolean {
    return this.status === 'pendiente';
  }

  /** «Reenviar» la liga: solo tiene sentido mientras sigue pendiente. */
  public markResent(): void {
    if (this.status === 'revocado') throw new ConsentLinkRevokedError();
    if (this.isGranted()) throw new ConsentAlreadySignedError();
    this.sentAt = new Date();
  }

  /**
   * Firma digital desde la página pública. Idempotente: si ya está otorgado
   * (digital o papel) no cambia nada; una liga revocada no puede firmarse.
   */
  public signDigitally(signedName: string): void {
    if (this.status === 'revocado') throw new ConsentLinkRevokedError();
    if (this.isGranted()) return;
    const name = signedName.replace(/\s+/g, ' ').trim();
    if (name.length < 5 || name.split(' ').length < 2) {
      throw new InvalidConsentSignatureError('Escribe tu nombre completo (nombre y apellido) tal como aparece en tu documento.');
    }
    this.status = 'firmado';
    this.signedAt = new Date();
    this.signedName = name;
    this.signatureKind = 'digital';
  }

  /** Alternativa papel: el profesional adjunta la foto/escaneo del documento firmado. */
  public attachPaper(filePath: string): void {
    if (this.status === 'firmado') throw new ConsentAlreadySignedError();
    // Una autorización que estuvo OTORGADA y luego se REVOCÓ (el titular la retiró) es
    // TERMINAL: no se "resucita" adjuntando papel —burlaría la revocación, Ley 1581—; para
    // re-documentar hay que emitir un consentimiento NUEVO. Una liga PENDIENTE revocada
    // (nunca firmada, signatureKind === '') sí admite el papel: es cancelar la liga y
    // documentar la firma física, limpiando la marca de revocado para no dejar un estado
    // contradictorio (otorgado + revoked_at).
    if (this.status === 'revocado' && this.signatureKind !== '') throw new ConsentLinkRevokedError();
    this.status = 'papel_adjunto';
    this.signedAt = new Date();
    this.signatureKind = 'papel';
    this.filePath = filePath;
    this.revokedAt = null;
  }

  /**
   * Revoca el consentimiento (Ley 1581 / Habeas Data): cancela la liga pendiente O
   * registra que el titular retiró su autorización ya otorgada. Conserva la firma previa
   * (signedAt/signedName) como rastro y sella la fecha de revocación. Idempotente.
   */
  public revoke(): void {
    if (this.status === 'revocado') return;
    this.status = 'revocado';
    this.revokedAt = new Date();
  }

  public revokedAtDate(): Date | null {
    return this.revokedAt;
  }

  /**
   * ¿Este consentimiento autoriza el procesamiento por IA AHORA? Exige estar OTORGADO, no revocado
   * y con la cláusula de finalidad-IA. Es la condición que el AiConsentGate hace cumplir antes de
   * que el asistente reciba cualquier dato del paciente.
   */
  public grantsAiProcessing(): boolean {
    return this.isGranted() && this.revokedAt === null && this.aiAuthorized;
  }

  public toPrimitives(): PatientConsentPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      token: this.token,
      templateTitle: this.templateTitle,
      templateBody: this.templateBody,
      status: this.status,
      sentAt: this.sentAt ? this.sentAt.toISOString() : null,
      signedAt: this.signedAt ? this.signedAt.toISOString() : null,
      signedName: this.signedName,
      signatureKind: this.signatureKind,
      filePath: this.filePath,
      createdAt: this.createdAt.toISOString(),
      revokedAt: this.revokedAt ? this.revokedAt.toISOString() : null,
      aiAuthorized: this.aiAuthorized,
    };
  }
}
