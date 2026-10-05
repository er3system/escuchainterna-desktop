import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaPaymentOverride } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
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
import { InvalidBookingDataError } from '@/contexts/scheduling/domain/errors/InvalidBookingDataError';

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
      noShowFee: { enabled: false, amount: 0 },
      lateCancelFee: { enabled: false, amount: 0 },
    };
  }
}

function buildAgenda(paymentOverride: AgendaPaymentOverride | null): Agenda {
  return Agenda.create('agenda-1', {
    name: 'Sesión individual',
    color: '#2180DB',
    slug: 'sesion-individual',
    durationMinutes: 60,
    slotIntervalMinutes: 60,
    minBookingHours: 0,
    bufferMinutes: 0,
    availabilityOverride: null,
    paymentOverride,
    locationOverride: null,
  });
}

function buildUseCase(agenda: Agenda): { useCase: CreateBooking; notifier: SilentNotifier } {
  const notifier = new SilentNotifier();
  const useCase = new CreateBooking(
    new InMemoryAgendaRepository([agenda]),
    new InMemoryBookingRepository(),
    new FakePatientDirectory(),
    new FakeMeetingLinks(),
    notifier,
    new FixedSettings(),
  );
  return { useCase, notifier };
}

// Reserva del profesional (no valida disponibilidad) en una semana.
const startAtIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

describe('CreateBooking (moneda del cobro)', () => {
  it('usa la moneda del perfil cuando la agenda no define una propia', async () => {
    const { useCase } = buildUseCase(buildAgenda(null));
    const [created] = await useCase.create(
      new CreateBookingMessage({ agendaId: 'agenda-1', patientId: 'paciente-1', startAtIso }),
    );
    expect(created.currency).toBe('COP');
    expect(created.price).toBe(120000);
  });

  it('usa la moneda efectiva de la agenda cuando su override define una', async () => {
    const { useCase } = buildUseCase(
      buildAgenda({
        price: 80,
        paymentMode: 'manual',
        showPrice: true,
        showStripeLink: false,
        currency: 'USD',
      }),
    );
    const [created] = await useCase.create(
      new CreateBookingMessage({ agendaId: 'agenda-1', patientId: 'paciente-1', startAtIso }),
    );
    expect(created.currency).toBe('USD');
    expect(created.price).toBe(80);
  });

  it("usa la moneda del perfil cuando el override la deja en '' (usar la del perfil)", async () => {
    const { useCase } = buildUseCase(
      buildAgenda({
        price: 80,
        paymentMode: 'manual',
        showPrice: true,
        showStripeLink: false,
        currency: '',
      }),
    );
    const [created] = await useCase.create(
      new CreateBookingMessage({ agendaId: 'agenda-1', patientId: 'paciente-1', startAtIso }),
    );
    expect(created.currency).toBe('COP');
  });

  it('la moneda explícita de la reserva («usar otra moneda») gana sobre la efectiva', async () => {
    const { useCase } = buildUseCase(
      buildAgenda({
        price: 80,
        paymentMode: 'manual',
        showPrice: true,
        showStripeLink: false,
        currency: 'USD',
      }),
    );
    const [created] = await useCase.create(
      new CreateBookingMessage({
        agendaId: 'agenda-1',
        patientId: 'paciente-1',
        startAtIso,
        price: 1500,
        currency: 'EUR',
      }),
    );
    expect(created.currency).toBe('EUR');
    expect(created.price).toBe(1500);
  });

  it('notifica la sesión con la moneda de la reserva', async () => {
    const { useCase, notifier } = buildUseCase(buildAgenda(null));
    await useCase.create(
      new CreateBookingMessage({
        agendaId: 'agenda-1',
        patientId: 'paciente-1',
        startAtIso,
        currency: 'EUR',
      }),
    );
    expect(notifier.notified).toHaveLength(1);
    expect(notifier.notified[0].currency).toBe('EUR');
  });
});

describe('CreateBooking (nota del paciente)', () => {
  it('persiste la nota del paciente en la reserva creada', async () => {
    const { useCase } = buildUseCase(buildAgenda(null));
    const [created] = await useCase.create(
      new CreateBookingMessage({
        agendaId: 'agenda-1',
        patientId: 'paciente-1',
        startAtIso,
        patientNote: '  Vengo por ansiedad antes de exponer  ',
      }),
    );
    expect(created.patientNote).toBe('Vengo por ansiedad antes de exponer');
  });

  it('deja la nota vacía cuando no se especifica', async () => {
    const { useCase } = buildUseCase(buildAgenda(null));
    const [created] = await useCase.create(
      new CreateBookingMessage({ agendaId: 'agenda-1', patientId: 'paciente-1', startAtIso }),
    );
    expect(created.patientNote).toBe('');
  });
});

describe('CreateBookingMessage (moneda)', () => {
  it('normaliza el código a mayúsculas', () => {
    const message = new CreateBookingMessage({
      agendaId: 'agenda-1',
      patientId: 'paciente-1',
      startAtIso,
      currency: 'usd',
    });
    expect(message.currencyValue()).toBe('USD');
  });

  it('devuelve null cuando no se especifica (usar la efectiva de la agenda)', () => {
    const message = new CreateBookingMessage({
      agendaId: 'agenda-1',
      patientId: 'paciente-1',
      startAtIso,
    });
    expect(message.currencyValue()).toBeNull();
  });

  it('rechaza monedas fuera del catálogo soportado', () => {
    expect(
      () =>
        new CreateBookingMessage({
          agendaId: 'agenda-1',
          patientId: 'paciente-1',
          startAtIso,
          currency: 'XXX',
        }),
    ).toThrow(InvalidBookingDataError);
  });
});
