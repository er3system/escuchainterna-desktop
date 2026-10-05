import { PatientNameRequiredError } from '../errors/PatientNameRequiredError';

export class PatientName {
  private readonly value: string;

  public constructor(value: string) {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (trimmed.length === 0) throw new PatientNameRequiredError();
    this.value = trimmed;
  }

  public isEqual(other: PatientName): boolean {
    return this.value.localeCompare(other.value, 'es', { sensitivity: 'base' }) === 0;
  }

  public toString(): string {
    return this.value;
  }
}
