import { CreateAgenda } from '../application/create-agenda/CreateAgenda';
import { UpdateAgenda } from '../application/update-agenda/UpdateAgenda';
import { ListAgendas } from '../application/list-agendas/ListAgendas';
import { DeactivateAgenda } from '../application/deactivate-agenda/DeactivateAgenda';
import { CreateBooking } from '../application/create-booking/CreateBooking';
import { RescheduleBooking } from '../application/reschedule-booking/RescheduleBooking';
import { CancelBooking } from '../application/cancel-booking/CancelBooking';
import { ConfirmBooking } from '../application/confirm-booking/ConfirmBooking';
import { CompleteBooking } from '../application/complete-booking/CompleteBooking';
import { MarkBookingNoShow } from '../application/mark-booking-no-show/MarkBookingNoShow';
import { SendSessionReminder } from '../application/send-session-reminder/SendSessionReminder';
import { FindAvailableSlots } from '../application/find-available-slots/FindAvailableSlots';
import { CalendarBookings } from '../application/calendar-bookings/CalendarBookings';
import { RequestPublicBooking } from '../application/request-public-booking/RequestPublicBooking';
import { CreateBlockedSlot } from '../application/blocked-slots/CreateBlockedSlot';
import { ListBlockedSlots } from '../application/blocked-slots/ListBlockedSlots';
import { DeleteBlockedSlot } from '../application/blocked-slots/DeleteBlockedSlot';
import { SqliteAgendaRepository } from './persistence/SqliteAgendaRepository';
import { SqliteBookingRepository } from './persistence/SqliteBookingRepository';
import { SqliteBlockedSlotRepository } from './persistence/SqliteBlockedSlotRepository';
import { SqlitePatientDirectory } from './persistence/SqlitePatientDirectory';
import { SqliteSchedulingSettings } from './persistence/SqliteSchedulingSettings';
import { SqliteBookingCalendarReadModel } from './persistence/SqliteBookingCalendarReadModel';
import { OutboxBookingNotifier } from './notifications/OutboxBookingNotifier';
import { LocalMeetingLinkProvider } from './meetings/LocalMeetingLinkProvider';

/**
 * Composición del contexto de agendamiento (adaptadores locales) acotada al
 * dueño: TODA lectura y escritura queda filtrada por owner_user_id.
 * En páginas privadas el owner es el usuario en sesión; en la página pública
 * /reservar/[slug] es el dueño resuelto a partir del slug.
 */
export function createSchedulingUseCases(ownerUserId: string) {
  const agendas = new SqliteAgendaRepository(ownerUserId);
  const bookings = new SqliteBookingRepository(ownerUserId);
  const blockedSlots = new SqliteBlockedSlotRepository(ownerUserId);
  const patients = new SqlitePatientDirectory(ownerUserId);
  const settings = new SqliteSchedulingSettings(ownerUserId);
  const notifier = new OutboxBookingNotifier(ownerUserId);
  const meetingLinks = new LocalMeetingLinkProvider();
  const createBooking = new CreateBooking(agendas, bookings, patients, meetingLinks, notifier, settings, blockedSlots);

  return {
    createAgenda: new CreateAgenda(agendas),
    updateAgenda: new UpdateAgenda(agendas),
    listAgendas: new ListAgendas(agendas),
    deactivateAgenda: new DeactivateAgenda(agendas),
    createBooking,
    rescheduleBooking: new RescheduleBooking(bookings, agendas, patients, settings, notifier, blockedSlots),
    cancelBooking: new CancelBooking(bookings, agendas, patients, settings, notifier),
    confirmBooking: new ConfirmBooking(bookings),
    completeBooking: new CompleteBooking(bookings),
    markBookingNoShow: new MarkBookingNoShow(bookings, settings),
    sendSessionReminder: new SendSessionReminder(bookings, agendas, patients, settings, notifier),
    findAvailableSlots: new FindAvailableSlots(agendas, bookings, settings, blockedSlots),
    calendarBookings: new CalendarBookings(new SqliteBookingCalendarReadModel(ownerUserId)),
    requestPublicBooking: new RequestPublicBooking(agendas, patients, createBooking),
    createBlockedSlot: new CreateBlockedSlot(blockedSlots),
    listBlockedSlots: new ListBlockedSlots(blockedSlots),
    deleteBlockedSlot: new DeleteBlockedSlot(blockedSlots),
  };
}
