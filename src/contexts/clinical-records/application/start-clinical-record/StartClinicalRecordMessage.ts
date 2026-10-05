export class StartClinicalRecordMessage {
  private readonly patientIdValue: string;
  private readonly templateIdValue: string | null;

  public constructor(input: { patientId: string; templateId: string | null }) {
    if (!input.patientId || input.patientId.trim() === '') {
      throw new Error('Falta el paciente para iniciar la historia clínica.');
    }
    this.patientIdValue = input.patientId.trim();
    this.templateIdValue = input.templateId && input.templateId.trim() !== '' ? input.templateId.trim() : null;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public templateId(): string | null {
    return this.templateIdValue;
  }
}
