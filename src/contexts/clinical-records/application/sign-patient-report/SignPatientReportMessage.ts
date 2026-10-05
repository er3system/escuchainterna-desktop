export class SignPatientReportMessage {
  private readonly reportIdValue: string;
  private readonly patientIdValue: string;
  private readonly signerUserIdValue: string;

  public constructor(input: { reportId: string; patientId: string; signerUserId: string }) {
    if (!input.reportId || !input.patientId || !input.signerUserId) {
      throw new Error('Faltan datos para firmar el reporte.');
    }
    this.reportIdValue = input.reportId;
    this.patientIdValue = input.patientId;
    this.signerUserIdValue = input.signerUserId;
  }

  public reportId(): string {
    return this.reportIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  /** Usuario autenticado que firma; su identidad (nombre + tarjeta) se resuelve en el caso de uso. */
  public signerUserId(): string {
    return this.signerUserIdValue;
  }
}
