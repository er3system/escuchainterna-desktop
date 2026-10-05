import { PatientPhone } from './PatientPhone';

/** Contacto de emergencia del paciente (nombre + teléfono, ambos opcionales). */
export class EmergencyContact {
  private readonly name: string;
  private readonly phone: PatientPhone;

  public constructor(name: string, phone: PatientPhone) {
    this.name = name.trim();
    this.phone = phone;
  }

  public static none(): EmergencyContact {
    return new EmergencyContact('', PatientPhone.empty());
  }

  public isEmpty(): boolean {
    return this.name.length === 0 && this.phone.isEmpty();
  }

  public contactName(): string {
    return this.name;
  }

  public contactPhone(): PatientPhone {
    return this.phone;
  }
}
