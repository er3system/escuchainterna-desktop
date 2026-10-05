import type { BookingPrimitives } from '../../domain/Booking';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { PatientDirectory } from '../../domain/PatientDirectory';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { CreateBooking } from '../create-booking/CreateBooking';
import { CreateBookingMessage } from '../create-booking/CreateBookingMessage';
import type { RequestPublicBookingMessage } from './RequestPublicBookingMessage';

/**
 * Flujo de la página pública: localiza la agenda por slug, encuentra o crea
 * al paciente por contacto y delega en CreateBooking con booked_by=paciente.
 */
export class RequestPublicBooking {
  public constructor(
    private readonly agendas: AgendaRepository,
    private readonly patients: PatientDirectory,
    private readonly createBooking: CreateBooking,
  ) {}

  public async request(message: RequestPublicBookingMessage): Promise<BookingPrimitives> {
    const agenda = await this.agendas.findBySlug(message.slugValue());
    if (!agenda || !agenda.isActive()) {
      throw new AgendaNotFoundError(message.slugValue());
    }
    const patient = await this.patients.findOrCreateByContact(message.contactValue());
    const created = await this.createBooking.create(
      new CreateBookingMessage({
        agendaId: agenda.agendaId(),
        patientId: patient.id,
        startAtIso: message.startAtIsoValue(),
        modality: message.modalityValue() ?? undefined,
        bookedBy: 'paciente',
        patientNote: message.patientNoteValue(),
      }),
    );
    return created[0];
  }
}
