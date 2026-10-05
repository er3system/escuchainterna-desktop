import { Email } from '@haskou/value-objects';
import { InvalidPatientEmailError } from '../errors/InvalidPatientEmailError';

/**
 * Correo del paciente. A diferencia de `Email` de la librería, admite el valor
 * vacío (el correo es opcional en el alta); si viene informado debe ser válido.
 */
export class PatientEmail {
  private readonly value: string;

  public constructor(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0) {
      this.value = '';
      return;
    }
    try {
      this.value = new Email(trimmed).toString();
    } catch {
      throw new InvalidPatientEmailError(trimmed);
    }
  }

  public static empty(): PatientEmail {
    return new PatientEmail('');
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public toString(): string {
    return this.value;
  }
}
