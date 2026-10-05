import { isPatientReportKind, type PatientReportKind } from '../../domain/value-objects/patientReportKinds';

export class CreatePatientReportMessage {
  private readonly patientIdValue: string;
  private readonly kindValue: PatientReportKind;
  private readonly countryCodeValue: string;

  public constructor(input: { patientId: string; kind: string; countryCode: string }) {
    if (!input.patientId) throw new Error('Falta el paciente del reporte.');
    if (!isPatientReportKind(input.kind)) {
      throw new Error(`Tipo de reporte desconocido: "${input.kind}".`);
    }
    if (input.kind === 'expediente') {
      throw new Error('La historia clínica completa se genera con su propia acción, no como reporte de IA.');
    }
    this.patientIdValue = input.patientId;
    this.kindValue = input.kind;
    this.countryCodeValue = (input.countryCode || 'OTRO').trim().toUpperCase();
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public kind(): PatientReportKind {
    return this.kindValue;
  }

  public countryCode(): string {
    return this.countryCodeValue;
  }
}
