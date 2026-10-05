import { Email } from '@haskou/value-objects';
import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';

/** Solicitud de reserva desde la página pública /reservar/<slug>. */
export class RequestPublicBookingMessage {
  private readonly slug: string;
  private readonly fullName: string;
  private readonly email: string;
  private readonly phone: string;
  private readonly phoneCountryCode: string;
  private readonly startAtIso: string;
  private readonly modality: string | null;
  private readonly patientNote: string;

  public constructor(input: {
    slug: string;
    fullName: string;
    email?: string;
    phone?: string;
    /** Indicativo del país del celular (v2 §6.1, p. ej. «+52»). */
    phoneCountryCode?: string;
    startAtIso: string;
    modality?: string;
    /** Nota / motivo de consulta que escribe el paciente al agendar (opcional). */
    patientNote?: string;
  }) {
    this.slug = (input.slug ?? '').trim().toLowerCase();
    if (!this.slug) {
      throw new InvalidBookingDataError('se requiere la liga de la agenda');
    }
    this.fullName = (input.fullName ?? '').trim();
    if (!this.fullName) {
      throw new InvalidBookingDataError('se requiere el nombre del paciente');
    }
    const email = (input.email ?? '').trim().toLowerCase();
    this.email = email ? new Email(email).toString() : '';
    this.phone = (input.phone ?? '').trim();
    this.phoneCountryCode = (input.phoneCountryCode ?? '').trim() || '+52';
    this.startAtIso = input.startAtIso;
    if (Number.isNaN(new Date(input.startAtIso).getTime())) {
      throw new InvalidBookingDataError(`fecha de inicio inválida «${input.startAtIso}»`);
    }
    this.modality = (input.modality ?? '').trim() || null;
    this.patientNote = (input.patientNote ?? '').trim();
  }

  public slugValue(): string {
    return this.slug;
  }

  public contactValue(): {
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode: string;
  } {
    return {
      fullName: this.fullName,
      email: this.email,
      phone: this.phone,
      phoneCountryCode: this.phoneCountryCode,
    };
  }

  public startAtIsoValue(): string {
    return this.startAtIso;
  }

  public modalityValue(): string | null {
    return this.modality;
  }

  /** Nota / motivo de consulta que escribió el paciente; '' = sin nota. */
  public patientNoteValue(): string {
    return this.patientNote;
  }
}
