import { EmptyPatientTagError } from '../errors/EmptyPatientTagError';

/** Colección de etiquetas del paciente: sin vacíos ni duplicados (insensible a mayúsculas). */
export class PatientTags {
  private constructor(private readonly values: string[]) {}

  public static fromValues(raw: string[]): PatientTags {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const tag of raw) {
      const trimmed = tag.trim();
      if (trimmed.length === 0) continue;
      const key = trimmed.toLocaleLowerCase('es');
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(trimmed);
    }
    return new PatientTags(cleaned);
  }

  public static none(): PatientTags {
    return new PatientTags([]);
  }

  public with(tag: string): PatientTags {
    const trimmed = tag.trim();
    if (trimmed.length === 0) throw new EmptyPatientTagError();
    if (this.has(trimmed)) return this;
    return new PatientTags([...this.values, trimmed]);
  }

  public without(tag: string): PatientTags {
    const key = tag.trim().toLocaleLowerCase('es');
    return new PatientTags(this.values.filter((value) => value.toLocaleLowerCase('es') !== key));
  }

  public has(tag: string): boolean {
    const key = tag.trim().toLocaleLowerCase('es');
    return this.values.some((value) => value.toLocaleLowerCase('es') === key);
  }

  public toValues(): string[] {
    return [...this.values];
  }
}
