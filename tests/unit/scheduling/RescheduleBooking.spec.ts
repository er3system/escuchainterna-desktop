import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaConfiguration } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import type { DayAvailabilityPrimitives } from '@/contexts/scheduling/domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '@/contexts/scheduling/domain/repositories/AgendaRepository';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { PatientContact, PatientDirectory } from '@/contexts/scheduling/domain/PatientDirectory';
import type { BookingNotifier, SessionNotificationData } from '@/contexts/scheduling/domain/BookingNotifier';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { RescheduleBooking } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBooking';
import { RescheduleBookingMessage } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBookingMessage';
import { BookingNotFoundError } from '@/contexts/scheduling/domain/errors/BookingNotFoundError';
import { AgendaNotFoundError } from '@/contexts/scheduling/domain/errors/AgendaNotFoundError';
import { BookingOverlapError } from '@/contexts/scheduling/domain/errors/BookingOverlapError';
import { BookingOutsideAvailabilityError } from '@/contexts/scheduling/domain/errors/BookingOutsideAvailabilityError';

// --- Dobles en memoria (adaptados de CreateBookingSlots.spec.ts) ------------

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

  public constructor(public readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    this.saved.push(booking);
    if (!this.bookings.includes(booking)) {
      this.bookings.push(booking);
    }
  }

  public async saveRecurrence(_recurrence: Recurrence): Promise<void> {}

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

class SilentNotifier implements BookingNotifier {
  public rescheduled: SessionNotificationData[] = [];

  public async sessionBooked(): Promise<void> {}

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

/** Reserva activa de 60 min sembrada para reagendar. */
function seededBooking(
  id: string,
  start: Date,
  durationMinutes = 60,
  agendaId = 'agenda-1',
): Booking {
  return Booking.create({
    id,
    agendaId,
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

interface HarnessOptions {
  agenda?: Agenda;
  agendas?: Agenda[];
  seededBookings?: Booking[];
  availability?: DayAvailabilityPrimitives[];
  patients?: PatientDirectory;
}

interface Harness {
  useCase: RescheduleBooking;
  notifier: SilentNotifier;
  bookings: InMemoryBookingRepository;
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const agendas = options.agendas ?? [options.agenda ?? buildAgenda()];
  const notifier = new SilentNotifier();
  const bookings = new InMemoryBookingRepository(options.seededBookings ?? []);
  const useCase = new RescheduleBooking(
    bookings,
    new InMemoryAgendaRepository(agendas),
    options.patients ?? new FakePatientDirectory(),
    new FixedSettings(options.availability ?? []),
    notifier,
  );
  return { useCase, notifier, bookings };
}

function isoOf(date: Date): string {
  return date.toISOString();
}

// Un miércoles concreto (2026-06-17 → getDay() === 3), hora LOCAL.
const WEDNESDAY_10AM = new Date(2026, 5, 17, 10, 0, 0, 0);
const WEDNESDAY_DAY = WEDNESDAY_10AM.getDay();
const WEDNESDAY_14PM = new Date(2026, 5, 17, 14, 0, 0, 0);

// `now` muy anterior a los slots para no rozar ninguna ventana temporal.
const NOW_WELL_BEFORE = new Date(2026, 5, 10, 0, 0, 0, 0);

// Disponibilidad amplia ese miércoles (08:00–20:00).
const WIDE_AVAILABILITY: DayAvailabilityPrimitives[] = [
  { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '20:00' }] },
];

describe('RescheduleBooking — reagenda OK', () => {
  it('mueve la reserva: newEnd = newStart + duración, guarda y devuelve primitivos con el nuevo horario', async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM, 90);
    const { useCase, bookings } = buildHarness({ seededBookings: [booking] });

    const result = await useCase.reschedule(
      new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_14PM) }),
      NOW_WELL_BEFORE,
    );

    const expectedEnd = new Date(WEDNESDAY_14PM.getTime() + 90 * 60 * 1000);
    expect(result.startAt).toBe(WEDNESDAY_14PM.toISOString());
    expect(result.endAt).toBe(expectedEnd.toISOString());
    expect(result.rescheduleCount).toBe(1);
    expect(result.status).toBe('agendada');
    // Persistió la reserva reagendada.
    expect(bookings.saved).toHaveLength(1);
    expect(bookings.saved[0].bookingId()).toBe('reserva-1');
  });
});

describe('RescheduleBooking — solapamiento (excluye la propia)', () => {
  it('lanza BookingOverlapError cuando OTRA reserva ocupa el nuevo horario', async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const otra = seededBooking('otra', WEDNESDAY_14PM);
    const { useCase } = buildHarness({ seededBookings: [booking, otra] });

    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_14PM) }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(BookingOverlapError);
  });

  it('permite reagendar a un horario que SOLO choca consigo misma (excludeBookingId)', async () => {
    // El nuevo horario se solapa parcialmente con la posición actual de la reserva,
    // pero como es la misma reserva (excluida), no debe contar como conflicto.
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const { useCase, bookings } = buildHarness({ seededBookings: [booking] });

    const newStart = new Date(WEDNESDAY_10AM.getTime() + 30 * 60 * 1000); // 10:30
    const result = await useCase.reschedule(
      new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(newStart) }),
      NOW_WELL_BEFORE,
    );

    expect(result.startAt).toBe(newStart.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });
});

describe('RescheduleBooking — disponibilidad por ruta', () => {
  it("ruta paciente: BookingOutsideAvailabilityError cuando el nuevo horario cae fuera de disponibilidad", async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    // Disponibilidad solo por la mañana; el nuevo slot (14:00) cae fuera.
    const morningOnly: DayAvailabilityPrimitives[] = [
      { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '12:00' }] },
    ];
    const { useCase } = buildHarness({ seededBookings: [booking], availability: morningOnly });

    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({
          bookingId: 'reserva-1',
          newStartIso: isoOf(WEDNESDAY_14PM),
          actor: 'paciente',
        }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(BookingOutsideAvailabilityError);
  });

  it('ruta profesional: omite la validación de disponibilidad', async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const morningOnly: DayAvailabilityPrimitives[] = [
      { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '12:00' }] },
    ];
    const { useCase, bookings } = buildHarness({ seededBookings: [booking], availability: morningOnly });

    const result = await useCase.reschedule(
      new RescheduleBookingMessage({
        bookingId: 'reserva-1',
        newStartIso: isoOf(WEDNESDAY_14PM),
        // actor por defecto = 'profesional'
      }),
      NOW_WELL_BEFORE,
    );

    expect(result.startAt).toBe(WEDNESDAY_14PM.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });

  it('ruta paciente: dentro de disponibilidad sí reagenda', async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const { useCase, bookings } = buildHarness({
      seededBookings: [booking],
      availability: WIDE_AVAILABILITY,
    });

    const result = await useCase.reschedule(
      new RescheduleBookingMessage({
        bookingId: 'reserva-1',
        newStartIso: isoOf(WEDNESDAY_14PM),
        actor: 'paciente',
      }),
      NOW_WELL_BEFORE,
    );

    expect(result.startAt).toBe(WEDNESDAY_14PM.toISOString());
    expect(bookings.saved).toHaveLength(1);
  });
});

describe('RescheduleBooking — recursos inexistentes', () => {
  it('lanza BookingNotFoundError cuando la reserva no existe', async () => {
    const { useCase } = buildHarness({ seededBookings: [] });
    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({ bookingId: 'inexistente', newStartIso: isoOf(WEDNESDAY_14PM) }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(BookingNotFoundError);
  });

  it('lanza AgendaNotFoundError cuando la agenda de la reserva no existe', async () => {
    // La reserva apunta a una agenda que el repositorio de agendas no conoce.
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM, 60, 'agenda-fantasma');
    const { useCase } = buildHarness({ agendas: [buildAgenda()], seededBookings: [booking] });

    await expect(
      useCase.reschedule(
        new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_14PM) }),
        NOW_WELL_BEFORE,
      ),
    ).rejects.toThrow(AgendaNotFoundError);
  });
});

describe('RescheduleBooking — notificación', () => {
  it('notifica sessionRescheduled cuando el paciente existe en el directorio', async () => {
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const { useCase, notifier } = buildHarness({ seededBookings: [booking] });

    await useCase.reschedule(
      new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_14PM) }),
      NOW_WELL_BEFORE,
    );

    expect(notifier.rescheduled).toHaveLength(1);
    expect(notifier.rescheduled[0].bookingId).toBe('reserva-1');
    expect(notifier.rescheduled[0].startAt).toBe(WEDNESDAY_14PM.toISOString());
  });

  it('no notifica ni revienta cuando el paciente no está en el directorio', async () => {
    // Directorio que nunca encuentra al paciente.
    const emptyDirectory: PatientDirectory = {
      findById: async () => null,
      findOrCreateByContact: async () => {
        throw new Error('no se debería invocar');
      },
    };
    const booking = seededBooking('reserva-1', WEDNESDAY_10AM);
    const { useCase, notifier, bookings } = buildHarness({
      seededBookings: [booking],
      patients: emptyDirectory,
    });

    const result = await useCase.reschedule(
      new RescheduleBookingMessage({ bookingId: 'reserva-1', newStartIso: isoOf(WEDNESDAY_14PM) }),
      NOW_WELL_BEFORE,
    );

    expect(result.startAt).toBe(WEDNESDAY_14PM.toISOString());
    expect(bookings.saved).toHaveLength(1);
    expect(notifier.rescheduled).toHaveLength(0);
  });
});
