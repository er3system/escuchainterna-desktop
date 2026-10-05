import { parseBookingActor, parseBookingModality } from '../../domain/Booking';
import type { BookingActor, BookingModality } from '../../domain/Booking';
import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';

export interface CreateBookingInput {
  agendaId: string;
  /** Paciente existente… */
  patientId?: string;
  /** …o datos de contacto para crearlo/encontrarlo. */
  contact?: { fullName: string; email?: string; phone?: string };
  startAtIso: string;
  /** Precio manual; si se omite se usa el precio efectivo de la agenda. */
  price?: number;
  /** Moneda del cobro (código soportado); si se omite se usa la efectiva de la agenda. */
  currency?: string;
  modality?: string;
  recurrence?: { frequency: string; repeatCount: number };
  bookedBy?: string;
  /** Nota del paciente al agendar (motivo en sus palabras); opcional. */
  patientNote?: string;
}

export interface ContactInput {
  fullName: string;
  email: string;
  phone: string;
}

/** Convierte una sola vez los primitivos de la reservación. */
export class CreateBookingMessage {
  private readonly agendaId: string;
  private readonly patientId: string | null;
  private readonly contact: ContactInput | null;
  private readonly startAt: Date;
  private readonly price: number | null;
  private readonly currency: string | null;
  private readonly modality: BookingModality | null;
  private readonly recurrence: { frequency: string; repeatCount: number } | null;
  private readonly bookedBy: BookingActor;
  private readonly patientNote: string;

  public constructor(input: CreateBookingInput) {
    this.agendaId = (input.agendaId ?? '').trim();
    if (!this.agendaId) {
      throw new InvalidBookingDataError('se requiere la agenda');
    }
    this.patientId = (input.patientId ?? '').trim() || null;
    const fullName = (input.contact?.fullName ?? '').trim();
    this.contact =
      !this.patientId && fullName
        ? {
            fullName,
            email: (input.contact?.email ?? '').trim().toLowerCase(),
            phone: (input.contact?.phone ?? '').trim(),
          }
        : null;
    if (!this.patientId && !this.contact) {
      throw new InvalidBookingDataError('se requiere un paciente o sus datos de contacto');
    }
    this.startAt = new Date(input.startAtIso);
    if (Number.isNaN(this.startAt.getTime())) {
      throw new InvalidBookingDataError(`fecha de inicio inválida «${input.startAtIso}»`);
    }
    if (input.price !== undefined && input.price !== null && input.price < 0) {
      throw new InvalidBookingDataError('el precio no puede ser negativo');
    }
    this.price = input.price ?? null;
    const currencyCode = (input.currency ?? '').trim().toUpperCase();
    if (currencyCode && !SUPPORTED_CURRENCIES.some((currency) => currency.code === currencyCode)) {
      throw new InvalidBookingDataError(`moneda no soportada «${currencyCode}»`);
    }
    this.currency = currencyCode || null;
    this.modality = input.modality ? parseBookingModality(input.modality) : null;
    this.recurrence = input.recurrence
      ? { frequency: input.recurrence.frequency, repeatCount: input.recurrence.repeatCount }
      : null;
    this.bookedBy = input.bookedBy ? parseBookingActor(input.bookedBy) : 'profesional';
    this.patientNote = (input.patientNote ?? '').trim();
  }

  public agendaIdValue(): string {
    return this.agendaId;
  }

  public patientIdValue(): string | null {
    return this.patientId;
  }

  public contactValue(): ContactInput | null {
    return this.contact;
  }

  public startDate(): Date {
    return this.startAt;
  }

  public priceValue(): number | null {
    return this.price;
  }

  /** Moneda explícita de la reserva o null para usar la efectiva de la agenda. */
  public currencyValue(): string | null {
    return this.currency;
  }

  public modalityPreference(): BookingModality | null {
    return this.modality;
  }

  public recurrenceInput(): { frequency: string; repeatCount: number } | null {
    return this.recurrence;
  }

  public bookedByValue(): BookingActor {
    return this.bookedBy;
  }

  /** Nota del paciente al agendar; '' = sin nota. */
  public patientNoteValue(): string {
    return this.patientNote;
  }
}
