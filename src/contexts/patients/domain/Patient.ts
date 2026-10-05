import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { PatientName } from './value-objects/PatientName';
import { PatientEmail } from './value-objects/PatientEmail';
import { PatientPhone } from './value-objects/PatientPhone';
import { CalendarDate } from './value-objects/CalendarDate';
import { EmergencyContact } from './value-objects/EmergencyContact';
import { PatientTags } from './value-objects/PatientTags';
import { PatientDocument } from './value-objects/PatientDocument';
import { PatientWasCreated } from './events/PatientWasCreated';
import { PatientWasArchived } from './events/PatientWasArchived';
import { PatientWasRestored } from './events/PatientWasRestored';
import { PatientAlreadyArchivedError } from './errors/PatientAlreadyArchivedError';
import { PatientIsNotArchivedError } from './errors/PatientIsNotArchivedError';
import { LEGAL_ADULT_AGE, isMinor, type PatientGuardian } from './value-objects/minor';

// Re-exportados desde aquí por compatibilidad con consumidores SERVIDOR/tests. Los CLIENT
// components deben importarlos de './value-objects/minor' (Patient.ts arrastra node:crypto).
export { LEGAL_ADULT_AGE, isMinor };
export type { PatientGuardian };

export const PATIENT_GENDERS = ['femenino', 'masculino', 'no_binario', 'prefiere_no_decir', 'otro'] as const;

export type PatientGender = (typeof PATIENT_GENDERS)[number] | '';

export function toPatientGender(raw: string): PatientGender {
  const value = raw.trim().toLocaleLowerCase('es').replace(/\s+/g, '_');
  return (PATIENT_GENDERS as readonly string[]).includes(value) ? (value as PatientGender) : '';
}

/** Datos clínico-biográficos del paciente que se completan después del alta mínima. */
export interface PatientProfile {
  birthDate: CalendarDate | null;
  gender: PatientGender;
  consultationReason: string;
  therapyStartDate: CalendarDate | null;
  notes: string;
}

export interface PatientPrimitives {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Indicativo del país del celular del paciente (v2 §6.1, p. ej. «+52»). */
  phoneCountryCode?: string;
  birthDate: string | null;
  gender: string;
  consultationReason: string;
  therapyStartDate: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  /** Indicativo del país del teléfono del contacto de emergencia. */
  emergencyPhoneCountryCode?: string;
  notes: string;
  tags: string[];
  /** Tipo de documento de identificación (§5). Opcional/retrocompatible. */
  documentType?: string;
  /** Número de documento de identificación (§5). Opcional/retrocompatible. */
  documentNumber?: string;
  /** Representante legal (acudiente): nombre. Obligatorio para menores. Opcional/retrocompatible. */
  guardianName?: string;
  /** Representante legal: parentesco/relación con el menor (texto libre). */
  guardianRelationship?: string;
  /** Representante legal: número de documento de identificación. */
  guardianDocument?: string;
  /**
   * Organización dueña del expediente (cuentas institucionales §1). null = cuenta
   * individual (el dueño es la persona, comportamiento histórico). Opcional/retrocompatible.
   */
  organizationId?: string | null;
  /** ¿Recibe recordatorios por WhatsApp? (Ajustes del paciente.) Default true. */
  receivesWhatsappReminders?: boolean;
  /** ¿Recibe recordatorios por correo? Default true. */
  receivesEmailReminders?: boolean;
  archived: boolean;
  createdAt: string;
}

export class Patient extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private fullName: PatientName,
    private email: PatientEmail,
    private phone: PatientPhone,
    private profile: PatientProfile,
    private emergencyContact: EmergencyContact,
    private tags: PatientTags,
    private document: PatientDocument,
    private guardian: PatientGuardian,
    private organizationId: string | null,
    private receivesWhatsappReminders: boolean,
    private receivesEmailReminders: boolean,
    private archived: boolean,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static create(
    id: string,
    fullName: PatientName,
    email: PatientEmail,
    phone: PatientPhone,
    profile: PatientProfile,
    emergencyContact: EmergencyContact,
    tags: PatientTags,
  ): Patient {
    const patient = new Patient(
      id,
      fullName,
      email,
      phone,
      profile,
      emergencyContact,
      tags,
      PatientDocument.empty(),
      { name: '', relationship: '', document: '' },
      null,
      true,
      true,
      false,
      new Date(),
    );
    patient.record(new PatientWasCreated(id, fullName.toString()));
    return patient;
  }

  public static fromPrimitives(primitives: PatientPrimitives): Patient {
    return new Patient(
      primitives.id,
      new PatientName(primitives.fullName),
      new PatientEmail(primitives.email),
      new PatientPhone(primitives.phone, primitives.phoneCountryCode),
      {
        birthDate: CalendarDate.fromNullable(primitives.birthDate),
        gender: toPatientGender(primitives.gender),
        consultationReason: primitives.consultationReason,
        therapyStartDate: CalendarDate.fromNullable(primitives.therapyStartDate),
        notes: primitives.notes,
      },
      new EmergencyContact(
        primitives.emergencyContactName,
        new PatientPhone(primitives.emergencyContactPhone, primitives.emergencyPhoneCountryCode),
      ),
      PatientTags.fromValues(primitives.tags),
      PatientDocument.of(primitives.documentType ?? '', primitives.documentNumber ?? ''),
      {
        name: primitives.guardianName ?? '',
        relationship: primitives.guardianRelationship ?? '',
        document: primitives.guardianDocument ?? '',
      },
      primitives.organizationId ?? null,
      primitives.receivesWhatsappReminders ?? true,
      primitives.receivesEmailReminders ?? true,
      primitives.archived,
      new Date(primitives.createdAt),
    );
  }

  public patientId(): string {
    return this.id;
  }

  public isArchived(): boolean {
    return this.archived;
  }

  /** Sin un teléfono válido el paciente no recibe recordatorios por WhatsApp. */
  public hasWhatsAppReachablePhone(): boolean {
    return this.phone.isValidForWhatsApp();
  }

  public archive(): void {
    if (this.archived) throw new PatientAlreadyArchivedError(this.id);
    this.archived = true;
    this.record(new PatientWasArchived(this.id));
  }

  public restore(): void {
    if (!this.archived) throw new PatientIsNotArchivedError(this.id);
    this.archived = false;
    this.record(new PatientWasRestored(this.id));
  }

  public tagWith(tag: string): void {
    this.tags = this.tags.with(tag);
  }

  public untag(tag: string): void {
    this.tags = this.tags.without(tag);
  }

  public retag(tags: PatientTags): void {
    this.tags = tags;
  }

  public updateContact(
    fullName: PatientName,
    email: PatientEmail,
    phone: PatientPhone,
    emergencyContact: EmergencyContact,
    document?: PatientDocument,
  ): void {
    this.fullName = fullName;
    this.email = email;
    this.phone = phone;
    this.emergencyContact = emergencyContact;
    if (document) this.document = document;
  }

  /** Fija el documento de identificación (§5). Lo usa el alta tras crear. */
  public setDocument(document: PatientDocument): void {
    this.document = document;
  }

  public documentOfRecord(): PatientDocument {
    return this.document;
  }

  /** Fija el representante legal (acudiente). Lo usa el alta/edición. Campos en claro. */
  public setGuardian(name: string, relationship: string, document: string): void {
    this.guardian = {
      name: name.trim(),
      relationship: relationship.trim(),
      document: document.trim(),
    };
  }

  public guardianOfRecord(): PatientGuardian {
    return this.guardian;
  }

  /**
   * Coloca el expediente bajo una organización (cuentas institucionales §1). La
   * organización es la dueña/responsable del dato; el acceso (owner_user_id) lo
   * lleva el tratante asignado por separado.
   */
  public placeInOrganization(organizationId: string): void {
    this.organizationId = organizationId;
  }

  public owningOrganizationId(): string | null {
    return this.organizationId;
  }

  public reminderPreferences(): { whatsapp: boolean; email: boolean } {
    return { whatsapp: this.receivesWhatsappReminders, email: this.receivesEmailReminders };
  }

  /** Fija si el paciente recibe recordatorios por cada canal (Ajustes del paciente). */
  public setReminderPreferences(whatsapp: boolean, email: boolean): void {
    this.receivesWhatsappReminders = whatsapp;
    this.receivesEmailReminders = email;
  }

  public updateProfile(profile: PatientProfile): void {
    this.profile = profile;
  }

  public toPrimitives(): PatientPrimitives {
    return {
      id: this.id,
      fullName: this.fullName.toString(),
      email: this.email.toString(),
      phone: this.phone.toString(),
      phoneCountryCode: this.phone.countryCodeValue(),
      birthDate: this.profile.birthDate ? this.profile.birthDate.toString() : null,
      gender: this.profile.gender,
      consultationReason: this.profile.consultationReason,
      therapyStartDate: this.profile.therapyStartDate ? this.profile.therapyStartDate.toString() : null,
      emergencyContactName: this.emergencyContact.contactName(),
      emergencyContactPhone: this.emergencyContact.contactPhone().toString(),
      emergencyPhoneCountryCode: this.emergencyContact.contactPhone().countryCodeValue(),
      notes: this.profile.notes,
      tags: this.tags.toValues(),
      documentType: this.document.typeValue(),
      documentNumber: this.document.numberValue(),
      guardianName: this.guardian.name,
      guardianRelationship: this.guardian.relationship,
      guardianDocument: this.guardian.document,
      organizationId: this.organizationId,
      receivesWhatsappReminders: this.receivesWhatsappReminders,
      receivesEmailReminders: this.receivesEmailReminders,
      archived: this.archived,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
