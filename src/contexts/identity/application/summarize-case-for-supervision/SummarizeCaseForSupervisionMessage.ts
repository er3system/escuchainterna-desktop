/** Petición de resumen de caso (IA) de un paciente de un supervisado. */
export class SummarizeCaseForSupervisionMessage {
  public constructor(
    private readonly input: {
      supervisorUserId: string;
      supervisedUserId: string;
      patientId: string;
    },
  ) {}

  public supervisorUserId(): string {
    return this.input.supervisorUserId;
  }

  public supervisedUserId(): string {
    return this.input.supervisedUserId;
  }

  public patientId(): string {
    return this.input.patientId;
  }
}
