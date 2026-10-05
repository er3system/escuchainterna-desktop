import { describe, it, expect } from 'vitest';
import { addDays, format, nextMonday } from 'date-fns';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import { BlockedSlot } from '@/contexts/scheduling/domain/BlockedSlot';
import { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
import type { AgendaRepository } from '@/contexts/scheduling/domain/repositories/AgendaRepository';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { BlockedSlotRepository } from '@/contexts/scheduling/domain/repositories/BlockedSlotRepository';
import type {
  GlobalSchedulingDefaults,
  SchedulingSettings,
} from '@/contexts/scheduling/domain/SchedulingSettings';
import { FindAvailableSlots } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlots';
import { FindAvailableSlotsQuery } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlotsQuery';
import { AgendaNotFoundError } from '@/contexts/scheduling/domain/errors/AgendaNotFoundError';

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
  public constructor(private readonly bookings: Booking[] = []) {}

  public async save(booking: Booking): Promise<void> {
    this.bookings.push(booking);
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

class InMemoryBlockedSlotRepository implements BlockedSlotRepository {
  public constructor(private readonly slots: BlockedSlot[] = []) {}

  public async save(slot: BlockedSlot): Promise<void> {
    this.slots.push(slot);
  }

  public async delete(id: string): Promise<void> {
    const index = this.slots.findIndex((slot) => slot.blockedSlotId() === id);
    if (index >= 0) this.slots.splice(index, 1);
  }

  public async findById(id: string): Promise<BlockedSlot | null> {
    return this.slots.find((slot) => slot.blockedSlotId() === id) ?? null;
  }

  public async findBetween(from: Date, to: Date): Promise<BlockedSlot[]> {
    return this.slots.filter((slot) => slot.overlaps(from, to));
  }

  public async listUpcoming(now: Date, limit: number): Promise<BlockedSlot[]> {
    return this.slots.filter((slot) => slot.end().getTime() > now.getTime()).slice(0, limit);
  }
}

class FixedSettings implements SchedulingSettings {
  public async getDefaults(): Promise<GlobalSchedulingDefaults> {
    return {
      practitionerName: 'Dra. Prueba',
      availability: [{ day: 1, ranges: [{ from: '09:00', to: '13:00' }] }], // solo lunes
      currency: 'MXN',
      defaultPrice: 500,
      paymentMode: 'manual',
      showPrice: true,
      paymentPolicies: '',
      modality: 'ambas',
      address: '',
      mapsUrl: '',
      cancellationMinHours: 24,
      noShowFee: { enabled: false, amount: 0 },
      lateCancelFee: { enabled: false, amount: 0 },
    };
  }
}

function buildAgenda(
  id: string,
  minBookingHours: number,
  options: { durationMinutes?: number; slotIntervalMinutes?: number; bufferMinutes?: number } = {},
): Agenda {
  return Agenda.create(id, {
    name: 'Sesión individual',
    color: '#2180DB',
    slug: `sesion-${id}`,
    durationMinutes: options.durationMinutes ?? 60,
    slotIntervalMinutes: options.slotIntervalMinutes ?? 60,
    minBookingHours,
    bufferMinutes: options.bufferMinutes ?? 0,
    availabilityOverride: null,
    paymentOverride: null,
    locationOverride: null,
  });
}

// Lunes futuro (al menos a una semana) para que el colchón de 0 horas no interfiera.
const monday = nextMonday(addDays(new Date(), 6));

function mondayAt(hours: number): Date {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), hours, 0, 0, 0);
}

describe('FindAvailableSlots', () => {
  it('descuenta de la disponibilidad los slots que se empalman con reservas', async () => {
    const agenda = buildAgenda('agenda-1', 0);
    const occupied = Booking.create({
      id: 'reserva-1',
      agendaId: 'agenda-1',
      patientId: 'paciente-1',
      startAt: mondayAt(10),
      endAt: mondayAt(11),
      price: 500,
      currency: 'MXN',
      modality: 'presencial',
      meetUrl: null,
      recurrenceId: null,
      bookedBy: 'profesional',
    });
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository([occupied]),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-1', fromDate: format(monday, 'yyyy-MM-dd'), days: 2 }),
    );
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe(format(monday, 'yyyy-MM-dd'));
    expect(result[0].slots).toEqual(['09:00', '11:00', '12:00']);
    // El martes no hay disponibilidad configurada.
    expect(result[1].slots).toEqual([]);
  });

  it('ignora reservas canceladas al calcular los slots', async () => {
    const agenda = buildAgenda('agenda-1', 0);
    const cancelled = Booking.create({
      id: 'reserva-2',
      agendaId: 'agenda-1',
      patientId: 'paciente-1',
      startAt: mondayAt(10),
      endAt: mondayAt(11),
      price: 500,
      currency: 'MXN',
      modality: 'presencial',
      meetUrl: null,
      recurrenceId: null,
      bookedBy: 'profesional',
    });
    cancelled.cancel('profesional', 0);
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository([cancelled]),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-1', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    expect(result[0].slots).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('aplica el colchón de horas mínimas para agendar', async () => {
    const agenda = buildAgenda('agenda-2', 24 * 365); // un año de anticipación: nada reservable
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository(),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-2', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    expect(result[0].slots).toEqual([]);
  });

  it('genera horarios que no caen en punto cuando el intervalo es menor a la duración', async () => {
    const agenda = buildAgenda('agenda-3', 0, { slotIntervalMinutes: 15 });
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository(),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-3', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    // Rango 09:00–13:00, duración 60, intervalo 15 → 09:00, 09:15, …, 12:00.
    expect(result[0].slots).toContain('09:15');
    expect(result[0].slots).toContain('10:30');
    expect(result[0].slots[0]).toBe('09:00');
    expect(result[0].slots.at(-1)).toBe('12:00');
  });

  it('reserva el colchón (buffer) después de cada sesión existente', async () => {
    const agenda = buildAgenda('agenda-4', 0, { slotIntervalMinutes: 30, bufferMinutes: 30 });
    const occupied = Booking.create({
      id: 'reserva-3',
      agendaId: 'agenda-4',
      patientId: 'paciente-1',
      startAt: mondayAt(11),
      endAt: mondayAt(12),
      price: 500,
      currency: 'MXN',
      modality: 'presencial',
      meetUrl: null,
      recurrenceId: null,
      bookedBy: 'profesional',
    });
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository([occupied]),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-4', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    // Sesión 11:00–12:00 + 30 min de colchón ocupa hasta 12:30; con sesiones de
    // 60 min ningún slot posterior cabe antes de las 13:00, así que solo quedan
    // los previos cuyo bloque (60 + 30) no toca la sesión: 09:00 y 09:30.
    expect(result[0].slots).toEqual(['09:00', '09:30']);
  });

  it('descuenta los espacios bloqueados manualmente (que no son pacientes)', async () => {
    const agenda = buildAgenda('agenda-5', 0);
    const block = BlockedSlot.create({
      id: 'bloqueo-1',
      startAt: mondayAt(10),
      endAt: mondayAt(11),
      title: 'Almuerzo',
    });
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository(),
      new FixedSettings(),
      new InMemoryBlockedSlotRepository([block]),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-5', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    // Rango 09:00–13:00, duración 60: el bloqueo 10:00–11:00 elimina el slot de
    // las 10:00; los demás siguen disponibles.
    expect(result[0].slots).toEqual(['09:00', '11:00', '12:00']);
  });

  it('sin repositorio de bloqueos se comporta como antes (no descuenta nada)', async () => {
    const agenda = buildAgenda('agenda-6', 0);
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([agenda]),
      new InMemoryBookingRepository(),
      new FixedSettings(),
    );
    const result = await useCase.find(
      new FindAvailableSlotsQuery({ agendaId: 'agenda-6', fromDate: format(monday, 'yyyy-MM-dd'), days: 1 }),
    );
    expect(result[0].slots).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('lanza AgendaNotFoundError si la agenda no existe', async () => {
    const useCase = new FindAvailableSlots(
      new InMemoryAgendaRepository([]),
      new InMemoryBookingRepository(),
      new FixedSettings(),
    );
    await expect(
      useCase.find(new FindAvailableSlotsQuery({ agendaId: 'nope', fromDate: '2026-06-15', days: 1 })),
    ).rejects.toThrow(AgendaNotFoundError);
  });
});
