import { PatientGender, PatientProfile, toPatientGender } from '../../domain/Patient';
import { PatientName } from '../../domain/value-objects/PatientName';
import { PatientEmail } from '../../domain/value-objects/PatientEmail';
import { PatientPhone } from '../../domain/value-objects/PatientPhone';
import { CalendarDate } from '../../domain/value-objects/CalendarDate';
import { EmergencyContact } from '../../domain/value-objects/EmergencyContact';
import { PatientTags } from '../../domain/value-objects/PatientTags';
import { PatientDocument } from '../../domain/value-objects/PatientDocument';

export interface CreatePatientInput {
  fullName: string;
  email?: string;
  phone?: string;
  /** Indicativo del país del celular (v2 §6.1, p. ej. «+52»). */
  phoneCountryCode?: string;
  birthDate?: string | null;
  gender?: string;
  consultationReason?: string;
  therapyStartDate?: string | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyPhoneCountryCode?: string;
  notes?: string;
  tags?: string[];
  /** Documento de identificación (§5): tipo + número, opcional al alta. */
  documentType?: string;
  documentNumber?: string;
  /** Representante legal (acudiente): nombre, parentesco y documento. Obligatorio para menores. */
  guardianName?: string;
  guardianRelationship?: string;
  guardianDocument?: string;
  /** Organización dueña del expediente (§1), si la cuenta es institucional. */
  organizationId?: string | null;
}

/** Traduce primitivos del formulario/CSV a objetos de valor una sola vez. */
export class CreatePatientMessage {
  private readonly fullName: PatientName;
  private readonly email: PatientEmail;
  private readonly phone: PatientPhone;
  private readonly birthDate: CalendarDate | null;
  private readonly gender: PatientGender;
  private readonly consultationReason: string;
  private readonly therapyStartDate: CalendarDate | null;
  private readonly emergencyContact: EmergencyContact;
  private readonly notes: string;
  private readonly tags: PatientTags;
  private readonly document: PatientDocument;
  private readonly guardian: { name: string; relationship: string; document: string };
  private readonly organizationId: string | null;

  public constructor(input: CreatePatientInput) {
    this.fullName = new PatientName(input.fullName ?? '');
    this.email = new PatientEmail(input.email ?? '');
    this.phone = new PatientPhone(input.phone ?? '', input.phoneCountryCode);
    this.birthDate = CalendarDate.fromNullable(input.birthDate);
    this.gender = toPatientGender(input.gender ?? '');
    this.consultationReason = (input.consultationReason ?? '').trim();
    this.therapyStartDate = CalendarDate.fromNullable(input.therapyStartDate);
    this.emergencyContact = new EmergencyContact(
      input.emergencyContactName ?? '',
      new PatientPhone(input.emergencyContactPhone ?? '', input.emergencyPhoneCountryCode),
    );
    this.notes = (input.notes ?? '').trim();
    this.tags = PatientTags.fromValues(input.tags ?? []);
    this.document = PatientDocument.of(input.documentType ?? '', input.documentNumber ?? '');
    this.guardian = {
      name: (input.guardianName ?? '').trim(),
      relationship: (input.guardianRelationship ?? '').trim(),
      document: (input.guardianDocument ?? '').trim(),
    };
    this.organizationId = input.organizationId ?? null;
  }

  public patientName(): PatientName {
    return this.fullName;
  }

  public patientEmail(): PatientEmail {
    return this.email;
  }

  public patientPhone(): PatientPhone {
    return this.phone;
  }

  public patientProfile(): PatientProfile {
    return {
      birthDate: this.birthDate,
      gender: this.gender,
      consultationReason: this.consultationReason,
      therapyStartDate: this.therapyStartDate,
      notes: this.notes,
    };
  }

  public patientEmergencyContact(): EmergencyContact {
    return this.emergencyContact;
  }

  public patientTags(): PatientTags {
    return this.tags;
  }

  public patientDocument(): PatientDocument {
    return this.document;
  }

  /** Representante legal (acudiente): nombre, parentesco y documento (vacíos si no aplica). */
  public patientGuardian(): { name: string; relationship: string; document: string } {
    return this.guardian;
  }

  /** ¿Se capturaron datos del representante legal en el alta? */
  public hasGuardian(): boolean {
    return (
      this.guardian.name !== '' || this.guardian.relationship !== '' || this.guardian.document !== ''
    );
  }

  /** Organización dueña (§1) o null si la cuenta es individual. */
  public owningOrganizationId(): string | null {
    return this.organizationId;
  }
}
