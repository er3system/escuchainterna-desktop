import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaConfiguration } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { BookingPenaltyFee } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import type { AgendaRepository } from '@/contexts/scheduling/domain/repositories/AgendaRepository';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { PatientContact, PatientDirectory } from '@/contexts/scheduling/domain/PatientDirectory';
import type { BookingNotifier, SessionNotificationData } from '@/contexts/scheduling/domain/BookingNotifier';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { CancelBooking } from '@/contexts/scheduling/application/cancel-booking/CancelBooking';
import { CancelBookingMessage } from '@/contexts/scheduling/application/cancel-booking/CancelBookingMessage';
import { BookingNotFoundError } from '@/contexts/scheduling/domain/errors/BookingNotFoundError';
import { CancellationWindowClosedError } from '@/contexts/scheduling/domain/errors/CancellationWindowClosedError';

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
  public constructor(public readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    const index = this.bookings.findIndex((b) => b.bookingId() === booking.bookingId());
    if (index >= 0) {
      this.bookings[index] = booking;
    } else {
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

/** Directorio que puede simular que el paciente NO existe (para el camino sin notificación). */
class FakePatientDirectory implements PatientDirectory {
  private readonly patient: PatientContact = {
    id: 'paciente-1',
    fullName: 'Paciente de Prueba',
    phone: '5512345678',
    email: 'paciente@ejemplo.com',
  };

  public constructor(private readonly knowsPatient: boolean = true) {}

  public async findById(id: string): Promise<PatientContact | null> {
    if (!this.knowsPatient) return null;
    return id === this.patient.id ? this.patient : null;
  }

  public async findOrCreateByContact(): Promise<PatientContact> {
    return this.patient;
  }
}

class SilentNotifier implements BookingNotifier {
  public cancelled: SessionNotificationData[] = [];

  public async sessionBooked(): Promise<void> {}

  public async sessionRescheduled(): Promise<void> {}

  public async sessionCancelled(data: SessionNotificationData): Promise<void> {
    this.cancelled.push(data);
  }

  public async sessionReminder(): Promise<void> {}
}

/** Settings con ventana de cancelación y tarifa por cancelación tardía configurables. */
class FixedSettings implements SchedulingSettings {
  public constructor(
    private readonly cancellationMinHours: number,
    private readonly lateCancelFee: BookingPenaltyFee,
  ) {}

  public async getDefaults(): Promise<GlobalSchedulingDefaults> {
    return {
      practitionerName: 'Dra. Prueba',
      availability: [],
      currency: 'COP',
      defaultPrice: 120000,
      paymentMode: 'manual',
      showPrice: true,
      paymentPolicies: '',
      modality: 'presencial',
      address: 'Consultorio 101',
      mapsUrl: '',
      cancellationMinHours: this.cancellationMinHours,
      noShowFee: { enabled: false, amount: 0 },
      lateCancelFee: this.lateCancelFee,
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

function buildAgenda(): Agenda {
  return Agenda.create('agenda-1', DEFAULT_AGENDA_CONFIG);
}

/** Reserva activa que empieza en `startAt` (1 h de duración). */
function buildBooking(startAt: Date): Booking {
  return Booking.create({
    id: 'reserva-1',
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAt,
    endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
    price: 120000,
    currency: 'COP',
    modality: 'presencial',
    meetUrl: null,
    recurrenceId: null,
    bookedBy: 'profesional',
  });
}

interface HarnessOptions {
  cancellationMinHours?: number;
  lateCancelFee?: BookingPenaltyFee;
  seededBooking?: Booking | null;
  knowsAgenda?: boolean;
  knowsPatient?: boolean;
}

interface Harness {
  useCase: CancelBooking;
  notifier: SilentNotifier;
  bookings: InMemoryBookingRepository;
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const notifier = new SilentNotifier();
  const seeded =
    options.seededBooking === undefined ? buildBooking(WEDNESDAY_10AM) : options.seededBooking;
  const bookings = new InMemoryBookingRepository(seeded ? [seeded] : []);
  const agendas = new InMemoryAgendaRepository(options.knowsAgenda === false ? [] : [buildAgenda()]);
  const useCase = new CancelBooking(
    bookings,
    agendas,
    new FakePatientDirectory(options.knowsPatient ?? true),
    new FixedSettings(
      options.cancellationMinHours ?? 24,
      options.lateCancelFee ?? { enabled: false, amount: 0 },
    ),
    notifier,
  );
  return { useCase, notifier, bookings };
}

function messageFor(actor?: string): CancelBookingMessage {
  return new CancelBookingMessage({ bookingId: 'reserva-1', actor });
}

// Sesión un miércoles a las 10:00. `now` se elige relativo a este instante.
const WEDNESDAY_10AM = new Date(2026, 5, 17, 10, 0, 0, 0);
// Muy por fuera de la ventana de 24 h (10 días antes): cancelación temprana.
const NOW_WELL_BEFORE = new Date(WEDNESDAY_10AM.getTime() - 10 * 24 * 60 * 60 * 1000);
// Dentro de la ventana de 24 h (a 2 h del inicio): cancelación tardía.
const NOW_WITHIN_WINDOW = new Date(WEDNESDAY_10AM.getTime() - 2 * 60 * 60 * 1000);

const LATE_FEE: BookingPenaltyFee = { enabled: true, amount: 60000 };

describe('CancelBooking — tarifa por cancelación tardía (dinero real)', () => {
  it('paciente FUERA de ventana: cancela sin tarifa (feeCharged=0)', async () => {
    const { useCase, bookings } = buildHarness({ lateCancelFee: LATE_FEE });
    const result = await useCase.cancel(messageFor('paciente'), NOW_WELL_BEFORE);

    expect(result.status).toBe('cancelada');
    expect(result.feeCharged).toBe(0);
    expect(result.feeReason).toBe('');
    expect(bookings.bookings[0].toPrimitives().status).toBe('cancelada');
  });

  it('PROFESIONAL DENTRO de la ventana con lateCancelFee.enabled: feeCharged=amount y feeReason=cancelacion_tardia', async () => {
    const { useCase, bookings } = buildHarness({ lateCancelFee: LATE_FEE });
    const result = await useCase.cancel(messageFor('profesional'), NOW_WITHIN_WINDOW);

    expect(result.status).toBe('cancelada');
    expect(result.feeCharged).toBe(LATE_FEE.amount);
    expect(result.feeReason).toBe('cancelacion_tardia');
    expect(bookings.bookings[0].toPrimitives().feeCharged).toBe(LATE_FEE.amount);
  });

  it('lateCancelFee.enabled=false: nunca cobra aunque sea tardía', async () => {
    const { useCase } = buildHarness({ lateCancelFee: { enabled: false, amount: 60000 } });
    const result = await useCase.cancel(messageFor('profesional'), NOW_WITHIN_WINDOW);

    expect(result.status).toBe('cancelada');
    expect(result.feeCharged).toBe(0);
    expect(result.feeReason).toBe('');
  });

  it('lateCancelFee.amount=0: nunca cobra aunque esté habilitada y sea tardía', async () => {
    const { useCase } = buildHarness({ lateCancelFee: { enabled: true, amount: 0 } });
    const result = await useCase.cancel(messageFor('profesional'), NOW_WITHIN_WINDOW);

    expect(result.status).toBe('cancelada');
    expect(result.feeCharged).toBe(0);
    expect(result.feeReason).toBe('');
  });
});

describe('CancelBooking — existencia y notificación', () => {
  it('lanza BookingNotFoundError cuando la reserva no existe', async () => {
    const { useCase, notifier } = buildHarness({ seededBooking: null });
    await expect(useCase.cancel(messageFor('profesional'), NOW_WELL_BEFORE)).rejects.toThrow(
      BookingNotFoundError,
    );
    expect(notifier.cancelled).toHaveLength(0);
  });

  it('notifica sessionCancelled cuando agenda y paciente existen', async () => {
    const { useCase, notifier } = buildHarness({ knowsAgenda: true, knowsPatient: true });
    await useCase.cancel(messageFor('profesional'), NOW_WELL_BEFORE);
    expect(notifier.cancelled).toHaveLength(1);
    expect(notifier.cancelled[0].bookingId).toBe('reserva-1');
  });

  it('NO notifica cuando la agenda no existe (cancelación sí ocurre)', async () => {
    const { useCase, notifier, bookings } = buildHarness({ knowsAgenda: false });
    const result = await useCase.cancel(messageFor('profesional'), NOW_WELL_BEFORE);
    expect(result.status).toBe('cancelada');
    expect(bookings.bookings[0].toPrimitives().status).toBe('cancelada');
    expect(notifier.cancelled).toHaveLength(0);
  });

  it('NO notifica cuando el paciente no existe (cancelación sí ocurre)', async () => {
    const { useCase, notifier, bookings } = buildHarness({ knowsPatient: false });
    const result = await useCase.cancel(messageFor('profesional'), NOW_WELL_BEFORE);
    expect(result.status).toBe('cancelada');
    expect(bookings.bookings[0].toPrimitives().status).toBe('cancelada');
    expect(notifier.cancelled).toHaveLength(0);
  });
});

describe('CancelBooking — ventana del paciente', () => {
  it('paciente DENTRO de la ventana → CancellationWindowClosedError', async () => {
    const { useCase, notifier, bookings } = buildHarness({ lateCancelFee: LATE_FEE });
    await expect(useCase.cancel(messageFor('paciente'), NOW_WITHIN_WINDOW)).rejects.toThrow(
      CancellationWindowClosedError,
    );
    // No se cancela ni se notifica: la reserva sigue activa.
    expect(bookings.bookings[0].toPrimitives().status).toBe('agendada');
    expect(notifier.cancelled).toHaveLength(0);
  });
});
