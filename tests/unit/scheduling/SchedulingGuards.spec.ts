import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaConfiguration } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import { BlockedSlot } from '@/contexts/scheduling/domain/BlockedSlot';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import type { DayAvailabilityPrimitives } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '@/contexts/scheduling/domain/repositories/AgendaRepository';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { BlockedSlotRepository } from '@/contexts/scheduling/domain/repositories/BlockedSlotRepository';
import type { PatientContact, PatientDirectory } from '@/contexts/scheduling/domain/PatientDirectory';
import type { MeetingLinkProvider } from '@/contexts/scheduling/domain/MeetingLinkProvider';
import type { BookingNotifier, SessionNotificationData } from '@/contexts/scheduling/domain/BookingNotifier';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { CreateBooking } from '@/contexts/scheduling/application/create-booking/CreateBooking';
import { CreateBookingMessage } from '@/contexts/scheduling/application/create-booking/CreateBookingMessage';
import { RescheduleBooking } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBooking';
import { RescheduleBookingMessage } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBookingMessage';
import { BookingOverlapError } from '@/contexts/scheduling/domain/errors/BookingOverlapError';
import { BookingTooSoonError } from '@/contexts/scheduling/domain/errors/BookingTooSoonError';
import { BlockedSlotConflictError } from '@/contexts/scheduling/domain/errors/BlockedSlotConflictError';

// --- Dobles en memoria (adaptados de CreateBookingSlots.spec.ts /
//     RescheduleBooking.spec.ts) ------------------------------------------------

class InMemoryAgendaRepository implements AgendaRepository {
  public constructor(private readonly agendas: Agenda[]) {}

  public async save(): Promise<void> {}

  public async findById(id: string): Promise<Agenda | null> {
    return this.agendas.find((agenda) => agenda.agendaId() === id) ?? null;
  }

  public async findBySlug(slug: string): Promise<Agenda | null> {
    return this.agendas.find((agenda) => agenda.slugValue() === slug) ?? null;
  }

  public async findAll(): Promise<Agenda[]> {
    return [...this.agendas];
  }
}

class InMemoryBookingRepository implements BookingRepository {
  public saved: Booking[] = [];
  public savedRecurrences: Recurrence[] = [];

  public constructor(public readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    this.saved.push(booking);
    if (!this.bookings.includes(booking)) {
      this.bookings.push(booking);
    }
  }

  public async saveRecurrence(recurrence: Recurrence): Promise<void> {
    this.savedRecurrences.push(recurrence);
  }

  public async findById(id: string): Promise<Booking | null> {
    return this.bookings.find((booking) => booking.bookingId() === id) ?? null;
  }

  public async findOverlapping(
    start: Date,
    end: Date,
    excludeBookingId?: string,
  ): Promise<Booking[]> {
    return this.bookings.filter(
      (booking) =>
        booking.isActive() && booking.overlaps(start, end) && booking.bookingId() !== excludeBookingId,
    );
  }

  public async findActiveBetween(from: Date, to: Date): Promise<Booking[]> {
    return this.bookings.filter((booking) => booking.isActive() && booking.overlaps(from, to));
  }
}

/**
 * Doble en memoria de BlockedSlotRepository. `findBetween` reproduce el contrato
 * real: bloqueos con algún traslape con [from, to). El resto de métodos cubren la
 * interfaz aunque el caso de uso solo use `findBetween`.
 */
class InMemoryBlockedSlotRepository implements BlockedSlotRepository {
  public constructor(private readonly slots: BlockedSlot[] = []) {}

  public async save(slot: BlockedSlot): Promise<void> {
    this.slots.push(slot);
  }

  public async delete(id: string): Promise<void> {
    const index = this.slots.findIndex((slot) => slot.blockedSlotId() === id);
    if (index >= 0) {
      this.slots.splice(index, 1);
    }
  }

  public async findById(id: string): Promise<BlockedSlot | null> {
    return this.slots.find((slot) => slot.blockedSlotId() === id) ?? null;
  }

  public async findBetween(from: Date, to: Date): Promise<BlockedSlot[]> {
    return this.slots.filter((slot) => slot.overlaps(from, to));
  }

  public async listUpcoming(now: Date, limit: number): Promise<BlockedSlot[]> {
    return this.slots
      .filter((slot) => slot.end().getTime() > now.getTime())
      .sort((a, b) => a.start().getTime() - b.start().getTime())
      .slice(0, limit);
  }
}

class FakePatientDirectory implements PatientDirectory {
  private readonly patient: PatientContact = {
    id: 'paciente-1',
    fullName: 'Paciente de Prueba',
    phone: '5512345678',
    email: 'paciente@ejemplo.com',
  };

  public async findById(id: string): Promise<PatientContact | null> {
    return id === this.patient.id ? this.patient : null;
  }

  public async findOrCreateByContact(): Promise<PatientContact> {
    return this.patient;
  }
}

class FakeMeetingLinks implements MeetingLinkProvider {
  public createMeetingLink(bookingId: string): string {
    return `https://meet.local/${bookingId}`;
  }
}

class SilentNotifier implements BookingNotifier {
  public booked: SessionNotificationData[] = [];
  public rescheduled: SessionNotificationData[] = [];

  public async sessionBooked(data: SessionNotificationData): Promise<void> {
    this.booked.push(data);
  }

  public async sessionRescheduled(data: SessionNotificationData): Promise<void> {
    this.rescheduled.push(data);
  }

  public async sessionCancelled(): Promise<void> {}

  public async sessionReminder(): Promise<void> {}
}

class FixedSettings implements SchedulingSettings {
  public constructor(private readonly availability: DayAvailabilityPrimitives[] = []) {}

  public async getDefaults(): Promise<GlobalSchedulingDefaults> {
    return {
      practitionerName: 'Dra. Prueba',
      availability: this.availability,
      currency: 'COP',
      defaultPrice: 120000,
      paymentMode: 'manual',
      showPrice: true,
      paymentPolicies: '',
      modality: 'presencial',
      address: 'Consultorio 101',
      mapsUrl: '',
      // Ventana de cancelación de 0 h: el paciente puede reagendar sin que la
      // ventana se cierre (este suite NO prueba la regla de ventana).
      cancellationMinHours: 0,
      noShowFee: { enabled: false, amount: 0 },
      lateCancelFee: { enabled: false, amount: 0 },
    };
  }
}

// --- Helpers ----------------------------------------------------------------

const DEFAULT_AGENDA_CONFIG: AgendaConfiguration = {
  name: 'Sesión individual',
  color: '#2180DB',
  slug: 'sesion-individual',
  durationMinutes: 60,
  slotIntervalMinutes: 60,
  minBookingHours: 0,
  bufferMinutes: 0,
  availabilityOverride: null,
  paymentOverride: null,
  locationOverride: null,
};

function buildAgenda(overrides: Partial<AgendaConfiguration> = {}): Agenda {
  return Agenda.create('agenda-1', { ...DEFAULT_AGENDA_CONFIG, ...overrides });
}

function seededBooking(id: string, start: Date, durationMinutes = 60): Booking {
  return Booking.create({
    id,
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAt: start,
    endAt: new Date(start.getTime() + durationMinutes * 60 * 1000),
    price: 120000,
    currency: 'COP',
    modality: 'presencial',
    meetUrl: null,
    recurrenceId: null,
    bookedBy: 'profesional',
  });
}

function blockedSlot(id: string, start: Date, end: Date, title = 'Bloqueo'): BlockedSlot {
  return BlockedSlot.create({ id, startAt: start, endAt: end, title });
}

// Un miércoles concreto (2026-06-17 → getDay() === 3), hora LOCAL.
const WEDNESDAY_DAY = new Date(2026, 5, 17, 10, 0, 0, 0).getDay();
const WEDNESDAY_9AM = new Date(2026, 5, 17, 9, 0, 0, 0);
const WEDNESDAY_10AM = new Date(2026, 5, 17, 10, 0, 0, 0);
const WEDNESDAY_11AM = new Date(2026, 5, 17, 11, 0, 0, 0);
const WEDNESDAY_12PM = new Date(2026, 5, 17, 12, 0, 0, 0);
const WEDNESDAY_1230PM = new Date(2026, 5, 17, 12, 30, 0, 0);
const WEDNESDAY_1PM = new Date(2026, 5, 17, 13, 0, 0, 0);

// Disponibilidad amplia ese miércoles (08:00–20:00) para no rozar la validación de cupo.
const WIDE_AVAILABILITY: DayAvailabilityPrimitives[] = [
  { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '20:00' }] },
];

// `now` muy anterior a los slots para no rozar ninguna ventana temporal.
const NOW_WELL_BEFORE = new Date(2026, 5, 10, 0, 0, 0, 0);

function isoOf(date: Date): string {
  return date.toISOString();
}

interface CreateHarnessOptions {
  agenda?: Agenda;
  seededBookings?: Booking[];
  availability?: DayAvailabilityPrimitives[];
  blockedSlots?: BlockedSlotRepository;
}

function buildCreateHarness(options: CreateHarnessOptions = {}): {
  useCase: CreateBooking;
  bookings: InMemoryBookingRepository;
} {
  const agenda = options.agenda ?? buildAgenda();
  const bookings = new InMemoryBookingRepository(options.seededBookings ?? []);
  const useCase = new CreateBooking(
    new InMemoryAgendaRepository([agenda]),
    bookings,
    new FakePatientDirectory(),
    new FakeMeetingLinks(),
    new SilentNotifier(),
    new FixedSettings(options.availability ?? []),
    options.blockedSlots, // último parámetro, OPCIONAL
  );
  return { useCase, bookings };
}

function createMessageFor(startAt: Date, bookedBy: 'paciente' | 'profesional'): CreateBookingMessage {
  return new CreateBookingMessage({
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAtIso: isoOf(startAt),
    bookedBy,
  });
}

interface RescheduleHarnessOptions {
  agenda?: Agenda;
  seededBookings?: Booking[];
  availability?: DayAvailabilityPrimitives[];
  blockedSlots?: BlockedSlotRepository;
}

function buildRescheduleHarness(options: RescheduleHarnessOptions = {}): {
  useCase: RescheduleBooking;
  bookings: InMemoryBookingRepository;
} {
  const agenda = options.agenda ?? buildAgenda();
  const bookings = new InMemoryBookingRepository(options.seededBookings ?? []);
  const useCase = new RescheduleBooking(
    bookings,
    new InMemoryAgendaRepository([agenda]),
    new FakePatientDirectory(),
    new FixedSettings(options.availability ?? []),
    new SilentNotifier(),
    options.blockedSlots, // último parámetro, OPCIONAL
  );
  return { useCase, bookings };
}

// --- COLCHÓN (CreateBooking) ------------------------------------------------

describe('CreateBooking — el colchón (buffer) cuenta en el solape', () => {
  // Duración 60, colchón 30. Reserva existente 11:00–12:00.
  // occupiedEnd(start) = start + 60 + 30; el solape se mide en [start - 30, occupiedEnd).
  function harnessWithExistingEleven() {
    return buildCreateHarness({
      agenda: buildAgenda({ bufferMinutes: 30 }),
      availability: WIDE_AVAILABILITY,
      seededBookings: [seededBooking('existente-11', WEDNESDAY_11AM, 60)],
    });
  }

  it('RECHAZA con BookingOverlapError al pedir 12:00 (queda dentro del colchón de la previa)', async () => {
    const { useCase } = harnessWithExistingEleven();
    // Ventana de solape para 12:00 = [11:30, 14:00); la previa (11:00–12:00) cae dentro.
    await expect(
      useCase.create(createMessageFor(WEDNESDAY_12PM, 'paciente'), NOW_WELL_BEFORE),
    ).rejects.toThrow(BookingOverlapError);
  });

  it('PERMITE pedir 12:30 (exactamente el colchón de 30 min tras la previa)', async () => {
    const { useCase, bookings } = harnessWithExistingEleven();
    // Ventana de solape para 12:30 = [12:00, 15:00); la previa termina en 12:00 (borde) → sin empalme.
    const created = await useCase.create(createMessageFor(WEDNESDAY_1230PM, 'paciente'), NOW_WELL_BEFORE);
    expect(created).toHaveLength(1);
    // queda la previa + la nueva.
    expect(bookings.bookings).toHaveLength(2);
  });
});

// --- BLOQUEO (CreateBooking) ------------------------------------------------

describe('CreateBooking — bloqueos manuales tapan el cupo', () => {
  it('con un BlockedSlotRepository que cubre 09:00–13:00, reservar 10:00 → BlockedSlotConflictError', async () => {
    const blocks = new InMemoryBlockedSlotRepository([
      blockedSlot('bloqueo-1', WEDNESDAY_9AM, WEDNESDAY_1PM, 'Mañana bloqueada'),
    ]);
    const { useCase } = buildCreateHarness({
      availability: WIDE_AVAILABILITY,
      blockedSlots: blocks,
    });
    await expect(
      useCase.create(createMessageFor(WEDNESDAY_10AM, 'paciente'), NOW_WELL_BEFORE),
    ).rejects.toThrow(BlockedSlotConflictError);
  });

  it('sin ese bloqueo (repo vacío) la misma reserva pasa', async () => {
    const { useCase, bookings } = buildCreateHarness({
      availability: WIDE_AVAILABILITY,
      blockedSlots: new InMemoryBlockedSlotRepository([]),
    });
    const created = await useCase.create(createMessageFor(WEDNESDAY_10AM, 'paciente'), NOW_WELL_BEFORE);
    expect(created).toHaveLength(1);
    expect(bookings.bookings).toHaveLength(1);
  });

  it('sin repo inyectado (parámetro omitido) la misma reserva pasa', async () => {
    const { useCase, bookings } = buildCreateHarness({ availability: WIDE_AVAILABILITY });
    const created = await useCase.create(createMessageFor(WEDNESDAY_10AM, 'paciente'), NOW_WELL_BEFORE);
    expect(created).toHaveLength(1);
    expect(bookings.bookings).toHaveLength(1);
  });
});

// --- BLOQUEO (RescheduleBooking) --------------------------------------------

describe('RescheduleBooking — bloqueos manuales también valen al reagendar', () => {
  it('reagendar sobre el bloqueo (09:00–13:00) → BlockedSlotConflictError', async () => {
    // Reserva existente a las 14:00; se reagenda a 10:00, que cae en el bloqueo.
    const booking = seededBooking('reserva-1', new Date(2026, 5, 17, 14, 0, 0, 0), 60);
    const blocks = new InMemoryBlockedSlotRepository([
      blockedSlot('bloqueo-1', WEDNESDAY_9AM, WEDNESDAY_1PM, 'Mañana bloqueada'),
    ]);
    const { useCase } = buildRescheduleHarness({
      availability: WIDE_AVAILABILITY,
      seededBookings: [booking],
      blockedSlots: blocks,
    });
    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_10AM) }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(BlockedSlotConflictError);
  });

  it('sin bloqueo en ese rango, el mismo reagendado pasa', async () => {
    const booking = seededBooking('reserva-1', new Date(2026, 5, 17, 14, 0, 0, 0), 60);
    const { useCase, bookings } = buildRescheduleHarness({
      availability: WIDE_AVAILABILITY,
      seededBookings: [booking],
      blockedSlots: new InMemoryBlockedSlotRepository([]),
    });
    const result = await useCase.reschedule(
      new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_10AM) }),
      NOW_WELL_BEFORE,
    );
    expect(result.startAt).toBe(WEDNESDAY_10AM.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });
});

// --- ANTICIPACIÓN (RescheduleBooking) ---------------------------------------

describe('RescheduleBooking — anticipación mínima al reagendar (minBookingHours)', () => {
  // minBookingHours=24. El slot destino es WEDNESDAY_10AM.
  function harness24h() {
    const booking = seededBooking('reserva-1', new Date(2026, 5, 16, 10, 0, 0, 0), 60);
    return buildRescheduleHarness({
      agenda: buildAgenda({ minBookingHours: 24 }),
      availability: WIDE_AVAILABILITY,
      seededBookings: [booking],
    });
  }

  it('el paciente reagenda a now+1h → BookingTooSoonError', async () => {
    const { useCase } = harness24h();
    const now = new Date(WEDNESDAY_10AM.getTime() - 60 * 60 * 1000); // 1 h antes del nuevo inicio
    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({
          bookingId: 'reserva-1',
          newStartIso: isoOf(WEDNESDAY_10AM),
          actor: 'paciente',
        }),
        now,
      ),
    ).rejects.toThrow(BookingTooSoonError);
  });

  it('el profesional a la MISMA hora NO lanza (omite la anticipación)', async () => {
    const { useCase, bookings } = harness24h();
    const now = new Date(WEDNESDAY_10AM.getTime() - 60 * 60 * 1000); // misma now de 1 h antes
    const result = await useCase.reschedule(
      new RescheduleBookingMessage({
        bookingId: 'reserva-1',
        newStartIso: isoOf(WEDNESDAY_10AM),
        // actor por defecto = 'profesional'
      }),
      now,
    );
    expect(result.startAt).toBe(WEDNESDAY_10AM.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });

  it('en el borde exacto (now + 24 h) el paciente NO lanza', async () => {
    const { useCase, bookings } = harness24h();
    const now = new Date(WEDNESDAY_10AM.getTime() - 24 * 60 * 60 * 1000); // exactamente 24 h antes
    const result = await useCase.reschedule(
      new RescheduleBookingMessage({
        bookingId: 'reserva-1',
        newStartIso: isoOf(WEDNESDAY_10AM),
        actor: 'paciente',
      }),
      now,
    );
    expect(result.startAt).toBe(WEDNESDAY_10AM.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });
});
