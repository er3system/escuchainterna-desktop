export class UpdatePatientReportMessage {
  private readonly reportIdValue: string;
  private readonly patientIdValue: string;
  private readonly titleValue: string;
  private readonly contentValue: string;
  private readonly reviewedValue: boolean;

  public constructor(input: {
    reportId: string;
    patientId: string;
    title: string;
    content: string;
    reviewed: boolean;
  }) {
    if (!input.reportId || !input.patientId) {
      throw new Error('Faltan datos para guardar el reporte.');
    }
    this.reportIdValue = input.reportId;
    this.patientIdValue = input.patientId;
    this.titleValue = typeof input.title === 'string' ? input.title : '';
    this.contentValue = typeof input.content === 'string' ? input.content : '';
    this.reviewedValue = input.reviewed === true;
  }

  public reportId(): string {
    return this.reportIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public title(): string {
    return this.titleValue;
  }

  public content(): string {
    return this.contentValue;
  }

  public reviewed(): boolean {
    return this.reviewedValue;
  }
}
