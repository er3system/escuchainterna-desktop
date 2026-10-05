export class SaveFamilyMapMessage {
  private readonly mapIdValue: string;
  private readonly patientIdValue: string;
  private readonly titleValue: string;
  private readonly dataValue: unknown;

  public constructor(input: { mapId: string; patientId: string; title: string; data: unknown }) {
    if (!input.mapId || !input.patientId) {
      throw new Error('Faltan datos para guardar el mapa familiar.');
    }
    this.mapIdValue = input.mapId;
    this.patientIdValue = input.patientId;
    this.titleValue = typeof input.title === 'string' ? input.title : '';
    this.dataValue = input.data;
  }

  public mapId(): string {
    return this.mapIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public title(): string {
    return this.titleValue;
  }

  public data(): unknown {
    return this.dataValue;
  }
}
