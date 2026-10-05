import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { DomainError } from '@/shared/domain/DomainError';

export type SignatureRequestStatus = 'pendiente' | 'firmado' | 'rechazado' | 'cancelado';

/** Una solicitud ya resuelta (firmada/rechazada/cancelada) no admite otra transición. */
export class SignatureRequestAlreadyResolvedError extends DomainError {
  public constructor() {
    super('Esta solicitud de firma ya fue resuelta.');
  }
}

export interface ReportSignatureRequestPrimitives {
  id: string;
  reportId: string;
  patientId: string;
  /** Practicante que pide la firma (y dueño del reporte). */
  requesterUserId: string;
  /** Supervisor a quien se le pide la firma. */
  supervisorUserId: string;
  /** Organización del vínculo de supervisión (para validar la vigencia). */
  organizationId: string;
  status: SignatureRequestStatus;
  /** Nota del practicante al pedir la firma. */
  note: string;
  /** Motivo del rechazo (o vacío). */
  resolutionNote: string;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * Solicitud de co-firma (spec co-firma): el practicante (sin tarjeta) pide a su
 * supervisor que firme un reporte que él redactó y revisó. El reporte sigue siendo
 * del practicante; el supervisor lo firma con SU tarjeta. Esta solicitud es el
 * artefacto que conecta a ambas partes y deja traza de quién pidió y quién resolvió.
 */
export class ReportSignatureRequest extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly reportId: string,
    private readonly patientId: string,
    private readonly requesterUserId: string,
    private readonly supervisorUserId: string,
    private readonly organizationId: string,
    private status: SignatureRequestStatus,
    private readonly note: string,
    private resolutionNote: string,
    private readonly createdAt: Date,
    private resolvedAt: Date | null,
  ) {
    super();
  }

  public static open(input: {
    id: string;
    reportId: string;
    patientId: string;
    requesterUserId: string;
    supervisorUserId: string;
    organizationId: string;
    note: string;
  }): ReportSignatureRequest {
    return new ReportSignatureRequest(
      input.id,
      input.reportId,
      input.patientId,
      input.requesterUserId,
      input.supervisorUserId,
      input.organizationId,
      'pendiente',
      input.note.trim(),
      '',
      new Date(),
      null,
    );
  }

  public static fromPrimitives(primitives: ReportSignatureRequestPrimitives): ReportSignatureRequest {
    return new ReportSignatureRequest(
      primitives.id,
      primitives.reportId,
      primitives.patientId,
      primitives.requesterUserId,
      primitives.supervisorUserId,
      primitives.organizationId,
      primitives.status,
      primitives.note,
      primitives.resolutionNote,
      new Date(primitives.createdAt),
      primitives.resolvedAt ? new Date(primitives.resolvedAt) : null,
    );
  }

  private ensurePending(): void {
    if (this.status !== 'pendiente') throw new SignatureRequestAlreadyResolvedError();
  }

  /** El supervisor firmó: la solicitud queda resuelta como 'firmado'. */
  public markSigned(): void {
    this.ensurePending();
    this.status = 'firmado';
    this.resolvedAt = new Date();
  }

  /** El supervisor rechaza con un motivo. */
  public reject(reason: string): void {
    this.ensurePending();
    this.status = 'rechazado';
    this.resolutionNote = reason.trim();
    this.resolvedAt = new Date();
  }

  /** El practicante cancela su propia solicitud aún pendiente. */
  public cancel(): void {
    this.ensurePending();
    this.status = 'cancelado';
    this.resolvedAt = new Date();
  }

  public requestId(): string {
    return this.id;
  }

  public isPending(): boolean {
    return this.status === 'pendiente';
  }

  public addressedTo(supervisorUserId: string): boolean {
    return this.supervisorUserId === supervisorUserId;
  }

  public requestedBy(requesterUserId: string): boolean {
    return this.requesterUserId === requesterUserId;
  }

  public forReport(reportId: string): boolean {
    return this.reportId === reportId;
  }

  public requester(): string {
    return this.requesterUserId;
  }

  public supervisor(): string {
    return this.supervisorUserId;
  }

  public organization(): string {
    return this.organizationId;
  }

  public report(): string {
    return this.reportId;
  }

  public patient(): string {
    return this.patientId;
  }

  public toPrimitives(): ReportSignatureRequestPrimitives {
    return {
      id: this.id,
      reportId: this.reportId,
      patientId: this.patientId,
      requesterUserId: this.requesterUserId,
      supervisorUserId: this.supervisorUserId,
      organizationId: this.organizationId,
      status: this.status,
      note: this.note,
      resolutionNote: this.resolutionNote,
      createdAt: this.createdAt.toISOString(),
      resolvedAt: this.resolvedAt ? this.resolvedAt.toISOString() : null,
    };
  }
}
