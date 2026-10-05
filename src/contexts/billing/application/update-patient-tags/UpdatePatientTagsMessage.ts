export class UpdatePatientTagsMessage {
  private readonly id: string;
  private readonly normalizedTags: string[];

  public constructor(input: { patientId: string; tags: string[] }) {
    const patientId = input.patientId.trim();
    if (!patientId) throw new Error('Falta el identificador del paciente.');
    this.id = patientId;

    const seen = new Set<string>();
    const tags: string[] = [];
    for (const raw of input.tags) {
      const tag = raw.trim().slice(0, 60);
      if (!tag) continue;
      const key = tag.toLocaleLowerCase('es-MX');
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
    this.normalizedTags = tags;
  }

  public patientId(): string {
    return this.id;
  }

  public tags(): string[] {
    return [...this.normalizedTags];
  }
}
