import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaConfiguration } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import { WeeklyAvailability } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import type { DayAvailabilityPrimitives } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '@/contexts/scheduling/domain/repositories/AgendaRepository';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { PatientContact, PatientDirectory } from '@/contexts/scheduling/domain/PatientDirectory';
import type { MeetingLinkProvider } from '@/contexts/scheduling/domain/MeetingLinkProvider';
import type { BookingNotifier, SessionNotificationData } from '@/contexts/scheduling/domain/BookingNotifier';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { CreateBooking } from '@/contexts/scheduling/application/create-booking/CreateBooking';
import { CreateBookingMessage } from '@/contexts/scheduling/application/create-booking/CreateBookingMessage';
import { BookingOverlapError } from '@/contexts/scheduling/domain/errors/BookingOverlapError';
import { BookingTooSoonError } from '@/contexts/scheduling/domain/errors/BookingTooSoonError';
import { BookingOutsideAvailabilityError } from '@/contexts/scheduling/domain/errors/BookingOutsideAvailabilityError';
import { AgendaNotFoundError } from '@/contexts/scheduling/domain/errors/AgendaNotFoundError';

// --- Dobles en memoria (adaptados de CreateBookingCurrency.spec.ts) ---------

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
  public savedRecurrences: Recurrence[] = [];

  public constructor(public readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    this.bookings.push(booking);
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

  /** Reservas creadas como parte de una serie recurrente concreta. */
  public bookingsWithRecurrence(recurrenceId: string): Booking[] {
    return this.bookings.filter((booking) => booking.toPrimitives().recurrenceId === recurrenceId);
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
  public notified: SessionNotificationData[] = [];

  public async sessionBooked(data: SessionNotificationData): Promise<void> {
    this.notified.push(data);
  }

  public async sessionRescheduled(): Promise<void> {}

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
      cancellationMinHours: 24,
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

interface HarnessOptions {
  agenda?: Agenda;
  seededBookings?: Booking[];
  availability?: DayAvailabilityPrimitives[];
}

interface Harness {
  useCase: CreateBooking;
  notifier: SilentNotifier;
  bookings: InMemoryBookingRepository;
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const agenda = options.agenda ?? buildAgenda();
  const notifier = new SilentNotifier();
  const bookings = new InMemoryBookingRepository(options.seededBookings ?? []);
  const useCase = new CreateBooking(
    new InMemoryAgendaRepository([agenda]),
    bookings,
    new FakePatientDirectory(),
    new FakeMeetingLinks(),
    notifier,
    new FixedSettings(options.availability ?? []),
  );
  return { useCase, notifier, bookings };
}

/** Construye una reserva ya existente (en estado activo) para sembrar solapamientos. */
function seededBooking(id: string, start: Date, end: Date): Booking {
  return Booking.create({
    id,
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAt: start,
    endAt: end,
    price: 120000,
    currency: 'COP',
    modality: 'presencial',
    meetUrl: null,
    recurrenceId: null,
    bookedBy: 'profesional',
  });
}

// Un miércoles concreto a las 10:00 hora LOCAL (la disponibilidad usa hora local).
// 2026-06-17 es miércoles → getDay() === 3.
const WEDNESDAY_10AM = new Date(2026, 5, 17, 10, 0, 0, 0);
const WEDNESDAY_DAY = WEDNESDAY_10AM.getDay();

function isoOf(date: Date): string {
  return date.toISOString();
}

function messageFor(
  startAt: Date,
  extra: { bookedBy?: string; recurrence?: { frequency: string; repeatCount: number } } = {},
): CreateBookingMessage {
  return new CreateBookingMessage({
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAtIso: isoOf(startAt),
    ...extra,
  });
}

// Disponibilidad amplia ese miércoles (08:00–20:00) para no chocar con la validación de cupo.
const WIDE_AVAILABILITY: DayAvailabilityPrimitives[] = [
  { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '20:00' }] },
];

// `now` muy anterior al slot para que nunca dispare BookingTooSoon en pruebas de disponibilidad.
const NOW_WELL_BEFORE = new Date(2026, 5, 10, 0, 0, 0, 0);

describe('CreateBooking — validación de cupo (paciente)', () => {
  it('lanza BookingOverlapError cuando el repo reporta un solapamiento', async () => {
    const start = WEDNESDAY_10AM;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const { useCase } = buildHarness({
      availability: WIDE_AVAILABILITY,
      seededBookings: [seededBooking('existente-1', start, end)],
    });
    await expect(
      useCase.create(messageFor(start, { bookedBy: 'paciente' }), NOW_WELL_BEFORE),
    ).rejects.toThrow(BookingOverlapError);
  });

  it('lanza BookingTooSoonError cuando el inicio cae antes de now + minBookingHours', async () => {
    const agenda = buildAgenda({ minBookingHours: 24, availabilityOverride: null });
    const start = WEDNESDAY_10AM;
    const { useCase } = buildHarness({ agenda, availability: WIDE_AVAILABILITY });
    // now a 23 h del inicio → 23 < 24 → demasiado pronto.
    const now = new Date(start.getTime() - 23 * 60 * 60 * 1000);
    await expect(useCase.create(messageFor(start, { bookedBy: 'paciente' }), now)).rejects.toThrow(
      BookingTooSoonError,
    );
  });

  it('en el BORDE exacto (now + minBookingHours) NO lanza BookingTooSoonError', async () => {
    const agenda = buildAgenda({ minBookingHours: 24, availabilityOverride: null });
    const start = WEDNESDAY_10AM;
    const { useCase, bookings } = buildHarness({ agenda, availability: WIDE_AVAILABILITY });
    // now exactamente a 24 h → differenceInMinutes === 1440 === 24*60 → no es «<».
    const now = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const created = await useCase.create(messageFor(start, { bookedBy: 'paciente' }), now);
    expect(created).toHaveLength(1);
    expect(bookings.bookings).toHaveLength(1);
  });

  it('lanza BookingOutsideAvailabilityError cuando el slot cae fuera de disponibilidad', async () => {
    // Disponibilidad solo por la mañana; el slot de las 10:00 cae fuera.
    const morningOnly: DayAvailabilityPrimitives[] = [
      { day: WEDNESDAY_DAY, ranges: [{ from: '06:00', to: '08:00' }] },
    ];
    const { useCase } = buildHarness({ availability: morningOnly });
    await expect(
      useCase.create(messageFor(WEDNESDAY_10AM, { bookedBy: 'paciente' }), NOW_WELL_BEFORE),
    ).rejects.toThrow(BookingOutsideAvailabilityError);
  });
});

describe('CreateBooking — el profesional omite disponibilidad y colchón, pero NO el solapamiento', () => {
  it('crea la reserva aunque la agenda esté fuera de horario y sin anticipación', async () => {
    // Sin disponibilidad configurada y minBookingHours alto: un paciente no podría,
    // pero el profesional sí.
    const agenda = buildAgenda({ minBookingHours: 48 });
    const { useCase, bookings } = buildHarness({ agenda, availability: [] });
    const start = WEDNESDAY_10AM;
    // now a solo 1 h del inicio (incumpliría el colchón de 48 h para un paciente).
    const now = new Date(start.getTime() - 60 * 60 * 1000);
    const created = await useCase.create(messageFor(start, { bookedBy: 'profesional' }), now);
    expect(created).toHaveLength(1);
    expect(bookings.bookings).toHaveLength(1);
  });

  it('aun así lanza BookingOverlapError cuando hay empalme', async () => {
    const start = WEDNESDAY_10AM;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const agenda = buildAgenda({ minBookingHours: 48 });
    const { useCase } = buildHarness({
      agenda,
      availability: [],
      seededBookings: [seededBooking('existente-1', start, end)],
    });
    await expect(
      useCase.create(messageFor(start, { bookedBy: 'profesional' }), NOW_WELL_BEFORE),
    ).rejects.toThrow(BookingOverlapError);
  });
});

describe('CreateBooking — agenda inactiva', () => {
  function inactiveAgenda(): Agenda {
    const agenda = buildAgenda();
    agenda.deactivate();
    return agenda;
  }

  it("bookedBy='paciente' → AgendaNotFoundError", async () => {
    const { useCase } = buildHarness({ agenda: inactiveAgenda(), availability: WIDE_AVAILABILITY });
    await expect(
      useCase.create(messageFor(WEDNESDAY_10AM, { bookedBy: 'paciente' }), NOW_WELL_BEFORE),
    ).rejects.toThrow(AgendaNotFoundError);
  });

  it("bookedBy='profesional' sí crea sobre una agenda inactiva", async () => {
    const { useCase, bookings } = buildHarness({
      agenda: inactiveAgenda(),
      availability: WIDE_AVAILABILITY,
    });
    const created = await useCase.create(
      messageFor(WEDNESDAY_10AM, { bookedBy: 'profesional' }),
      NOW_WELL_BEFORE,
    );
    expect(created).toHaveLength(1);
    expect(bookings.bookings).toHaveLength(1);
  });
});

describe('CreateBooking — recurrencia', () => {
  it('crea N reservas con el MISMO recurrenceId y guarda la Recurrence una sola vez', async () => {
    const { useCase, bookings } = buildHarness({ availability: WIDE_AVAILABILITY });
    const created = await useCase.create(
      messageFor(WEDNESDAY_10AM, {
        bookedBy: 'profesional',
        recurrence: { frequency: 'semanal', repeatCount: 4 },
      }),
      NOW_WELL_BEFORE,
    );

    expect(created).toHaveLength(4);
    const recurrenceIds = new Set(created.map((booking) => booking.recurrenceId));
    expect(recurrenceIds.size).toBe(1);
    const [recurrenceId] = [...recurrenceIds];
    expect(recurrenceId).not.toBeNull();
    expect(bookings.bookings).toHaveLength(4);
    expect(bookings.savedRecurrences).toHaveLength(1);
    expect(bookings.savedRecurrences[0].recurrenceId()).toBe(recurrenceId);
  });

  it('si una ocurrencia intermedia solapa, aborta TODA la serie (el repo queda sin reservas de la serie)', async () => {
    // La 3.ª ocurrencia (semana +2) choca con una reserva preexistente.
    const thirdStart = new Date(WEDNESDAY_10AM.getTime() + 2 * 7 * 24 * 60 * 60 * 1000);
    const thirdEnd = new Date(thirdStart.getTime() + 60 * 60 * 1000);
    const { useCase, bookings } = buildHarness({
      availability: WIDE_AVAILABILITY,
      seededBookings: [seededBooking('preexistente', thirdStart, thirdEnd)],
    });

    await expect(
      useCase.create(
        messageFor(WEDNESDAY_10AM, {
          bookedBy: 'profesional',
          recurrence: { frequency: 'semanal', repeatCount: 4 },
        }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(BookingOverlapError);

    // No quedó ninguna reserva con recurrenceId (solo está la sembrada, sin serie).
    const seriesBookings = bookings.bookings.filter(
      (booking) => booking.toPrimitives().recurrenceId !== null,
    );
    expect(seriesBookings).toHaveLength(0);
    // Solo permanece la reserva sembrada manualmente.
    expect(bookings.bookings).toHaveLength(1);
    expect(bookings.bookings[0].bookingId()).toBe('preexistente');
  });
});

describe('CreateBooking — notificación de series', () => {
  it('una serie de exactamente 3 notifica las 3', async () => {
    const { useCase, notifier } = buildHarness({ availability: WIDE_AVAILABILITY });
    const created = await useCase.create(
      messageFor(WEDNESDAY_10AM, {
        bookedBy: 'profesional',
        recurrence: { frequency: 'semanal', repeatCount: 3 },
      }),
      NOW_WELL_BEFORE,
    );
    expect(created).toHaveLength(3);
    expect(notifier.notified).toHaveLength(3);
  });

  it('una serie de 4 notifica solo la primera', async () => {
    const { useCase, notifier } = buildHarness({ availability: WIDE_AVAILABILITY });
    const created = await useCase.create(
      messageFor(WEDNESDAY_10AM, {
        bookedBy: 'profesional',
        recurrence: { frequency: 'semanal', repeatCount: 4 },
      }),
      NOW_WELL_BEFORE,
    );
    expect(created).toHaveLength(4);
    expect(notifier.notified).toHaveLength(1);
    expect(notifier.notified[0].bookingId).toBe(created[0].id);
  });
});
