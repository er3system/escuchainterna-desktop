import type { Agenda } from '../../domain/Agenda';
import type { Booking } from '../../domain/Booking';
import type { PatientContact } from '../../domain/PatientDirectory';
import type { SessionNotificationData } from '../../domain/BookingNotifier';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';

/**
 * Resuelve los datos efectivos (ubicación, pago, profesional) que necesita
 * el notificador a partir de la reserva, su agenda y el paciente.
 */
export class SessionNotificationAssembler {
  public constructor(private readonly settings: SchedulingSettings) {}

  public async assemble(
    booking: Booking,
    agenda: Agenda,
    patient: PatientContact,
  ): Promise<SessionNotificationData> {
    const defaults = await this.settings.getDefaults();
    const payment = agenda.effectivePrice({
      price: defaults.defaultPrice,
      paymentMode: defaults.paymentMode,
      showPrice: defaults.showPrice,
      currency: defaults.currency,
      paymentsEnabled: defaults.paymentsEnabled,
    });
    const location = agenda.effectiveLocation({
      modality: defaults.modality,
      address: defaults.address,
      mapsUrl: defaults.mapsUrl,
    });
    const primitives = booking.toPrimitives();
    return {
      bookingId: primitives.id,
      patient,
      practitionerName: defaults.practitionerName,
      startAt: primitives.startAt,
      durationMinutes: booking.durationMinutes(),
      modality: primitives.modality,
      address: location.address,
      mapsUrl: location.mapsUrl,
      meetUrl: primitives.meetUrl,
      price: primitives.price,
      // El precio notificado es el de la reserva, así que la moneda también
      // (puede ser un override puntual distinto al efectivo de la agenda).
      currency: primitives.currency || payment.currency,
      showPrice: payment.showPrice,
      showPaymentLink: payment.showPaymentLink,
      paymentPolicies: defaults.paymentPolicies,
    };
  }
}
