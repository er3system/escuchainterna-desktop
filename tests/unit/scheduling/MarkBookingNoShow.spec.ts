import { describe, it, expect } from 'vitest';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { BookingPenaltyFee, BookingStatus } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { MarkBookingNoShow } from '@/contexts/scheduling/application/mark-booking-no-show/MarkBookingNoShow';
import { InvalidBookingTransitionError } from '@/contexts/scheduling/domain/errors/InvalidBookingTransitionError';
import { BookingNotFoundError } from '@/contexts/scheduling/domain/errors/BookingNotFoundError';

// --- Dobles en memoria (adaptados de CreateBookingSlots.spec.ts) ------------

class InMemoryBookingRepository implements BookingRepository {
  public savedRecurrences: Recurrence[] = [];

  public constructor(public readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    // El caso de uso vuelve a guardar la MISMA instancia que ya tenía el repo:
    // reemplaza la entrada existente o la añade si es nueva.
    const index = this.bookings.findIndex((b) => b.bookingId() === booking.bookingId());
    if (index >= 0) {
      this.bookings[index] = booking;
    } else {
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

class FixedSettings implements SchedulingSettings {
  public constructor(private readonly noShowFee: BookingPenaltyFee) {}

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
      cancellationMinHours: 24,
      noShowFee: this.noShowFee,
      lateCancelFee: { enabled: false, amount: 0 },
    };
  }
}

// --- Helpers ----------------------------------------------------------------

const START = new Date(2026, 5, 17, 10, 0, 0, 0);
const END = new Date(START.getTime() + 60 * 60 * 1000);

/** Construye una reserva activa (estado 'agendada') lista para marcar inasistencia. */
function buildBooking(id = 'reserva-1'): Booking {
  return Booking.create({
    id,
    agendaId: 'agenda-1',
    patientId: 'paciente-1',
    startAt: START,
    endAt: END,
    price: 120000,
    currency: 'COP',
    modality: 'presencial',
    meetUrl: null,
    recurrenceId: null,
    bookedBy: 'profesional',
  });
}

/** Reserva ya en un estado terminal (sellado) para probar las transiciones inválidas. */
function bookingInStatus(status: BookingStatus, id = 'reserva-1'): Booking {
  const base = buildBooking(id).toPrimitives();
  return Booking.fromPrimitives({ ...base, status });
}

function buildUseCase(
  noShowFee: BookingPenaltyFee,
  seeded: Booking[] = [],
): { useCase: MarkBookingNoShow; repo: InMemoryBookingRepository } {
  const repo = new InMemoryBookingRepository(seeded);
  const useCase = new MarkBookingNoShow(repo, new FixedSettings(noShowFee));
  return { useCase, repo };
}

// --- Dominio: Booking.markAsNoShow -----------------------------------------

describe('Booking.markAsNoShow — dominio', () => {
  it('con tarifa habilitada y monto > 0 cobra la tarifa de inasistencia', () => {
    const booking = buildBooking();
    booking.markAsNoShow({ enabled: true, amount: 80000 });
    const primitives = booking.toPrimitives();
    expect(primitives.status).toBe('inasistencia');
    expect(primitives.feeCharged).toBe(80000);
    expect(primitives.feeReason).toBe('inasistencia');
  });

  it('con la tarifa DESHABILITADA marca inasistencia sin cobrar', () => {
    const booking = buildBooking();
    booking.markAsNoShow({ enabled: false, amount: 80000 });
    const primitives = booking.toPrimitives();
    expect(primitives.status).toBe('inasistencia');
    expect(primitives.feeCharged).toBe(0);
    expect(primitives.feeReason).toBe('');
  });

  it('con tarifa habilitada pero monto 0 marca inasistencia sin cobrar', () => {
    const booking = buildBooking();
    booking.markAsNoShow({ enabled: true, amount: 0 });
    const primitives = booking.toPrimitives();
    expect(primitives.status).toBe('inasistencia');
    expect(primitives.feeCharged).toBe(0);
    expect(primitives.feeReason).toBe('');
  });

  it('sin política de tarifa (undefined) marca inasistencia sin cobrar', () => {
    const booking = buildBooking();
    booking.markAsNoShow();
    const primitives = booking.toPrimitives();
    expect(primitives.status).toBe('inasistencia');
    expect(primitives.feeCharged).toBe(0);
    expect(primitives.feeReason).toBe('');
  });

  it('rechaza marcar inasistencia sobre una reserva CANCELADA', () => {
    const booking = bookingInStatus('cancelada');
    expect(() => booking.markAsNoShow({ enabled: true, amount: 80000 })).toThrow(
      InvalidBookingTransitionError,
    );
  });

  it('rechaza marcar inasistencia sobre una reserva COMPLETADA', () => {
    const booking = bookingInStatus('completada');
    expect(() => booking.markAsNoShow({ enabled: true, amount: 80000 })).toThrow(
      InvalidBookingTransitionError,
    );
  });

  it('rechaza marcar inasistencia sobre una reserva que YA es inasistencia', () => {
    const booking = bookingInStatus('inasistencia');
    expect(() => booking.markAsNoShow({ enabled: true, amount: 80000 })).toThrow(
      InvalidBookingTransitionError,
    );
  });
});

// --- Caso de uso: MarkBookingNoShow ----------------------------------------

describe('MarkBookingNoShow — caso de uso', () => {
  it('pasa la tarifa de inasistencia de settings al dominio y persiste el resultado', async () => {
    const seeded = buildBooking('reserva-1');
    const { useCase, repo } = buildUseCase({ enabled: true, amount: 80000 }, [seeded]);

    const result = await useCase.markAsNoShow('reserva-1');

    expect(result.status).toBe('inasistencia');
    expect(result.feeCharged).toBe(80000);
    expect(result.feeReason).toBe('inasistencia');
    // Quedó guardada y sigue siendo una sola reserva.
    expect(repo.bookings).toHaveLength(1);
    expect(repo.bookings[0].toPrimitives().status).toBe('inasistencia');
  });

  it('con la tarifa deshabilitada en settings marca inasistencia sin cobrar', async () => {
    const seeded = buildBooking('reserva-1');
    const { useCase } = buildUseCase({ enabled: false, amount: 80000 }, [seeded]);

    const result = await useCase.markAsNoShow('reserva-1');

    expect(result.status).toBe('inasistencia');
    expect(result.feeCharged).toBe(0);
    expect(result.feeReason).toBe('');
  });

  it('lanza BookingNotFoundError cuando la reserva no existe', async () => {
    const { useCase } = buildUseCase({ enabled: true, amount: 80000 }, []);
    await expect(useCase.markAsNoShow('inexistente')).rejects.toThrow(BookingNotFoundError);
  });
});
