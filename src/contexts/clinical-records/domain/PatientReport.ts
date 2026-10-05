import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import type { PatientReportKind, PatientReportStatus } from './value-objects/patientReportKinds';
import { ReportNotReviewedError } from './errors/ReportNotReviewedError';
import { SignedReportIsImmutableError } from './errors/SignedReportIsImmutableError';

export interface PatientReportPrimitives {
  id: string;
  patientId: string;
  kind: PatientReportKind;
  title: string;
  content: string;
  status: PatientReportStatus;
  signedBy: string;
  licenseNumber: string;
  /** Usuario autenticado que firmó (no repudio); '' si aún sin firmar. */
  signedByUserId: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reporte clínico-legal firmable (spec v2 §7): la IA solo produce el borrador;
 * el documento exige revisión humana explícita y firma (nombre + cédula) para
 * imprimirse sin marca de agua BORRADOR. Firmado ⇒ inmutable.
 */
export class PatientReport extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly kind: PatientReportKind,
    private title: string,
    private content: string,
    private status: PatientReportStatus,
    private signedBy: string,
    private licenseNumber: string,
    private signedByUserId: string,
    private signedAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static draft(input: {
    id: string;
    patientId: string;
    kind: PatientReportKind;
    title: string;
    content: string;
  }): PatientReport {
    const now = new Date();
    return new PatientReport(
      input.id,
      input.patientId,
      input.kind,
      input.title.trim() === '' ? 'Reporte' : input.title.trim(),
      input.content,
      'borrador',
      '',
      '',
      '',
      null,
      now,
      now,
    );
  }

  public static fromPrimitives(primitives: PatientReportPrimitives): PatientReport {
    return new PatientReport(
      primitives.id,
      primitives.patientId,
      primitives.kind,
      primitives.title,
      primitives.content,
      primitives.status,
      primitives.signedBy,
      primitives.licenseNumber,
      primitives.signedByUserId ?? '',
      primitives.signedAt ? new Date(primitives.signedAt) : null,
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  /** Edición de contenido; al editar, la revisión previa deja de valer. */
  public edit(input: { title: string; content: string; reviewed: boolean }): void {
    this.ensureNotSigned();
    if (input.title.trim() !== '') this.title = input.title.trim();
    this.content = input.content;
    this.status = input.reviewed ? 'revisado' : 'borrador';
    this.updatedAt = new Date();
  }

  /**
   * Firma: requiere revisión previa. La identidad (nombre + tarjeta profesional) y el
   * usuario firmante los resuelve la capa de aplicación desde el PERFIL del usuario
   * autenticado (nunca texto libre del cliente); el gate por licencia vive allí.
   */
  public sign(input: { signedBy: string; licenseNumber: string; signedByUserId: string }): void {
    this.ensureNotSigned();
    if (this.status !== 'revisado') throw new ReportNotReviewedError(this.id);
    const signedBy = input.signedBy.trim();
    const license = input.licenseNumber.trim();
    if (signedBy === '' || license === '') {
      throw new ReportNotReviewedError(this.id, 'La firma requiere nombre completo y tarjeta profesional.');
    }
    this.signedBy = signedBy;
    this.licenseNumber = license;
    this.signedByUserId = input.signedByUserId;
    this.signedAt = new Date();
    this.status = 'firmado';
    this.updatedAt = this.signedAt;
  }

  private ensureNotSigned(): void {
    if (this.status === 'firmado') throw new SignedReportIsImmutableError(this.id);
  }

  public reportId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public isSigned(): boolean {
    return this.status === 'firmado';
  }

  public toPrimitives(): PatientReportPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      kind: this.kind,
      title: this.title,
      content: this.content,
      status: this.status,
      signedBy: this.signedBy,
      licenseNumber: this.licenseNumber,
      signedByUserId: this.signedByUserId,
      signedAt: this.signedAt ? this.signedAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
