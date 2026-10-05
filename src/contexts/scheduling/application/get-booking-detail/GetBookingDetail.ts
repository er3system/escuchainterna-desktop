import type { BookingPrimitives } from '../../domain/Booking';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { PatientContact, PatientDirectory } from '../../domain/PatientDirectory';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { BookingNotFoundError } from '../../domain/errors/BookingNotFoundError';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { PatientNotFoundInDirectoryError } from '../../domain/errors/PatientNotFoundInDirectoryError';

/** Detalle completo de una reservación para el panel de la agenda. */
export interface BookingDetail {
  booking: BookingPrimitives;
  patient: PatientContact;
  agendaName: string;
  agendaColor: string;
  /** Ubicación efectiva (override de la agenda o global del perfil). */
  address: string;
  mapsUrl: string;
  /** Moneda efectiva de la agenda (la reserva trae la suya en booking.currency). */
  currency: string;
}

export class GetBookingDetail {
  public constructor(
    private readonly bookings: BookingRepository,
    private readonly agendas: AgendaRepository,
    private readonly patients: PatientDirectory,
    private readonly settings: SchedulingSettings,
  ) {}

  public async get(bookingId: string): Promise<BookingDetail> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    const agenda = await this.agendas.findById(booking.agendaReference());
    if (!agenda) {
      throw new AgendaNotFoundError(booking.agendaReference());
    }
    const patient = await this.patients.findById(booking.patientReference());
    if (!patient) {
      throw new PatientNotFoundInDirectoryError(booking.patientReference());
    }
    const defaults = await this.settings.getDefaults();
    const location = agenda.effectiveLocation({
      modality: defaults.modality,
      address: defaults.address,
      mapsUrl: defaults.mapsUrl,
    });
    const agendaPrimitives = agenda.toPrimitives();
    return {
      booking: booking.toPrimitives(),
      patient,
      agendaName: agendaPrimitives.name,
      agendaColor: agendaPrimitives.color,
      address: location.address,
      mapsUrl: location.mapsUrl,
      currency: agenda.effectiveCurrency(defaults.currency),
    };
  }
}
