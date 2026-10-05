export class RegisterDiagnosisMessage {
  private readonly patientIdValue: string;
  private readonly cie11CodeValue: string;
  private readonly notesValue: string;
  private readonly registeredByUserIdValue: string;

  public constructor(input: {
    patientId: string;
    cie11Code: string;
    notes: string;
    /** Usuario que registra la hipótesis (queda como responsable inicial). */
    registeredByUserId?: string;
  }) {
    if (!input.patientId) throw new Error('Falta el paciente para registrar el diagnóstico.');
    const code = input.cie11Code?.trim() ?? '';
    if (!code) throw new Error('Selecciona una entrada CIE-11 para registrar el diagnóstico.');
    this.patientIdValue = input.patientId;
    this.cie11CodeValue = code;
    this.notesValue = input.notes?.trim() ?? '';
    this.registeredByUserIdValue = input.registeredByUserId ?? '';
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public cie11Code(): string {
    return this.cie11CodeValue;
  }

  public notes(): string {
    return this.notesValue;
  }

  public registeredByUserId(): string {
    return this.registeredByUserIdValue;
  }
}
