import { describe, it, expect } from 'vitest';
import { Agenda } from '@/contexts/scheduling/domain/Agenda';
import type { AgendaConfiguration } from '@/contexts/scheduling/domain/Agenda';
import { Booking } from '@/contexts/scheduling/domain/Booking';
import type { Recurrence } from '@/contexts/scheduling/domain/Recurrence';
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
import { RequestPublicBooking } from '@/contexts/scheduling/application/request-public-booking/RequestPublicBooking';
import { RequestPublicBookingMessage } from '@/contexts/scheduling/application/request-public-booking/RequestPublicBookingMessage';
import { BookingOverlapError } from '@/contexts/scheduling/domain/errors/BookingOverlapError';
import { BookingOutsideAvailabilityError } from '@/contexts/scheduling/domain/errors/BookingOutsideAvailabilityError';
import { AgendaNotFoundError } from '@/contexts/scheduling/domain/errors/AgendaNotFoundError';
import { InvalidBookingDataError } from '@/contexts/scheduling/domain/errors/InvalidBookingDataError';

// --- Dobles en memoria (reutilizados de CreateBookingSlots.spec.ts) ---------

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
}

/**
 * Directorio que distingue "encontrar" de "crear" y registra cada llamada,
 * para verificar la superficie pública contra los repos en memoria.
 */
class RecordingPatientDirectory implements PatientDirectory {
  public createdCount = 0;
  public lastContact: {
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode?: string;
  } | null = null;

  public constructor(private readonly existing: PatientContact[] = []) {}

  public async findById(id: string): Promise<PatientContact | null> {
    return this.existing.find((patient) => patient.id === id) ?? null;
  }

  public async findOrCreateByContact(input: {
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode?: string;
  }): Promise<PatientContact> {
    this.lastContact = input;
    const found = this.existing.find(
      (patient) => patient.email === input.email && input.email !== '',
    );
    if (found) {
      return found;
    }
    this.createdCount += 1;
    const created: PatientContact = {
      id: `paciente-creado-${this.createdCount}`,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
    };
    this.existing.push(created);
    return created;
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

const AGENDA_SLUG = 'sesion-individual';

const DEFAULT_AGENDA_CONFIG: AgendaConfiguration = {
  name: 'Sesión individual',
  color: '#2180DB',
  slug: AGENDA_SLUG,
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

// El flujo público delega en CreateBooking SIN pasar `now`, así que el caso de
// uso compara contra la hora real. Anclamos el slot bien en el futuro (un
// miércoles de 2027) para que nunca dispare BookingTooSoon por estar en el pasado.
// 2027-06-16 es miércoles → getDay() === 3. La disponibilidad usa hora local.
const WEDNESDAY_10AM = new Date(2027, 5, 16, 10, 0, 0, 0);
const WEDNESDAY_DAY = WEDNESDAY_10AM.getDay();

const WIDE_AVAILABILITY: DayAvailabilityPrimitives[] = [
  { day: WEDNESDAY_DAY, ranges: [{ from: '08:00', to: '20:00' }] },
];

function isoOf(date: Date): string {
  return date.toISOString();
}

interface HarnessOptions {
  agenda?: Agenda;
  seededBookings?: Booking[];
  availability?: DayAvailabilityPrimitives[];
  existingPatients?: PatientContact[];
}

interface Harness {
  useCase: RequestPublicBooking;
  agendas: InMemoryAgendaRepository;
  bookings: InMemoryBookingRepository;
  patients: RecordingPatientDirectory;
  notifier: SilentNotifier;
}

function buildHarness(options: HarnessOptions = {}): Harness {
  const agenda = options.agenda ?? buildAgenda();
  const agendas = new InMemoryAgendaRepository([agenda]);
  const bookings = new InMemoryBookingRepository(options.seededBookings ?? []);
  const patients = new RecordingPatientDirectory(options.existingPatients ?? []);
  const notifier = new SilentNotifier();
  const createBooking = new CreateBooking(
    agendas,
    bookings,
    patients,
    new FakeMeetingLinks(),
    notifier,
    new FixedSettings(options.availability ?? []),
  );
  const useCase = new RequestPublicBooking(agendas, patients, createBooking);
  return { useCase, agendas, bookings, patients, notifier };
}

function publicMessage(
  overrides: Partial<{
    slug: string;
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode: string;
    startAtIso: string;
    modality: string;
  }> = {},
): RequestPublicBookingMessage {
  return new RequestPublicBookingMessage({
    slug: AGENDA_SLUG,
    fullName: 'Juana Pérez',
    email: 'juana@ejemplo.com',
    phone: '5512345678',
    startAtIso: isoOf(WEDNESDAY_10AM),
    ...overrides,
  });
}

// --- Superficie pública SIN autenticación -----------------------------------

describe('RequestPublicBooking — agenda no disponible públicamente', () => {
  it('slug inexistente → AgendaNotFoundError y NO crea paciente ni reserva', async () => {
    const { useCase, bookings, patients } = buildHarness({ availability: WIDE_AVAILABILITY });
    await expect(useCase.request(publicMessage({ slug: 'no-existe' }))).rejects.toThrow(
      AgendaNotFoundError,
    );
    expect(patients.createdCount).toBe(0);
    expect(patients.lastContact).toBeNull();
    expect(bookings.bookings).toHaveLength(0);
  });

  it('agenda INACTIVA → AgendaNotFoundError y NO crea paciente ni reserva', async () => {
    const agenda = buildAgenda();
    agenda.deactivate();
    const { useCase, bookings, patients } = buildHarness({
      agenda,
      availability: WIDE_AVAILABILITY,
    });
    await expect(useCase.request(publicMessage())).rejects.toThrow(AgendaNotFoundError);
    expect(patients.createdCount).toBe(0);
    expect(patients.lastContact).toBeNull();
    expect(bookings.bookings).toHaveLength(0);
  });
});

describe('RequestPublicBooking — paciente por contacto y delegación en CreateBooking', () => {
  it('crea el paciente por contacto cuando no existe y delega con bookedBy=paciente', async () => {
    const { useCase, bookings, patients } = buildHarness({ availability: WIDE_AVAILABILITY });

    const created = await useCase.request(publicMessage());

    expect(patients.createdCount).toBe(1);
    expect(patients.lastContact?.fullName).toBe('Juana Pérez');
    expect(bookings.bookings).toHaveLength(1);
    expect(bookings.bookings[0].toPrimitives().bookedBy).toBe('paciente');
    // Devuelve la PRIMERA reserva creada, ligada al paciente recién creado.
    expect(created.id).toBe(bookings.bookings[0].bookingId());
    expect(created.patientId).toBe('paciente-creado-1');
  });

  it('reutiliza el paciente existente por contacto (no crea uno nuevo)', async () => {
    const existing: PatientContact = {
      id: 'paciente-existente',
      fullName: 'Juana Pérez',
      phone: '5512345678',
      email: 'juana@ejemplo.com',
    };
    const { useCase, bookings, patients } = buildHarness({
      availability: WIDE_AVAILABILITY,
      existingPatients: [existing],
    });

    const created = await useCase.request(publicMessage());

    expect(patients.createdCount).toBe(0);
    expect(created.patientId).toBe('paciente-existente');
    expect(bookings.bookings).toHaveLength(1);
    expect(bookings.bookings[0].toPrimitives().bookedBy).toBe('paciente');
  });
});

describe('RequestPublicBooking — hereda las reglas de CreateBooking (paciente)', () => {
  it('una reserva pública que solapa → BookingOverlapError', async () => {
    const end = new Date(WEDNESDAY_10AM.getTime() + 60 * 60 * 1000);
    const { useCase, patients } = buildHarness({
      availability: WIDE_AVAILABILITY,
      seededBookings: [seededBooking('existente-1', WEDNESDAY_10AM, end)],
    });
    await expect(useCase.request(publicMessage())).rejects.toThrow(BookingOverlapError);
    // El paciente se encontró/creó antes del fallo de cupo; lo que importa es que no hay reserva nueva.
    expect(patients.lastContact).not.toBeNull();
  });

  it('un slot fuera de horario → BookingOutsideAvailabilityError', async () => {
    // Disponibilidad solo por la mañana; el slot de las 10:00 cae fuera.
    const morningOnly: DayAvailabilityPrimitives[] = [
      { day: WEDNESDAY_DAY, ranges: [{ from: '06:00', to: '08:00' }] },
    ];
    const { useCase, bookings } = buildHarness({ availability: morningOnly });
    await expect(useCase.request(publicMessage())).rejects.toThrow(BookingOutsideAvailabilityError);
    expect(bookings.bookings).toHaveLength(0);
  });
});

describe('RequestPublicBookingMessage — validación de la entrada pública', () => {
  it('normaliza el slug a minúsculas (y así casa con findBySlug)', async () => {
    const message = new RequestPublicBookingMessage({
      slug: '  SESION-Individual  ',
      fullName: 'Juana Pérez',
      startAtIso: isoOf(WEDNESDAY_10AM),
    });
    expect(message.slugValue()).toBe('sesion-individual');

    // Y de extremo a extremo: con el slug en mayúsculas la agenda se encuentra.
    const { useCase, bookings } = buildHarness({ availability: WIDE_AVAILABILITY });
    const created = await useCase.request(publicMessage({ slug: 'SESION-INDIVIDUAL' }));
    expect(created.agendaId).toBe('agenda-1');
    expect(bookings.bookings).toHaveLength(1);
  });

  it('exige el nombre del paciente', () => {
    expect(
      () =>
        new RequestPublicBookingMessage({
          slug: AGENDA_SLUG,
          fullName: '   ',
          startAtIso: isoOf(WEDNESDAY_10AM),
        }),
    ).toThrow(InvalidBookingDataError);
  });

  it('valida el correo cuando se proporciona', () => {
    expect(
      () =>
        new RequestPublicBookingMessage({
          slug: AGENDA_SLUG,
          fullName: 'Juana Pérez',
          email: 'no-es-un-correo',
          startAtIso: isoOf(WEDNESDAY_10AM),
        }),
    ).toThrow();
  });

  it('aplica el indicativo de país por defecto (+52) cuando se omite', () => {
    const message = new RequestPublicBookingMessage({
      slug: AGENDA_SLUG,
      fullName: 'Juana Pérez',
      startAtIso: isoOf(WEDNESDAY_10AM),
    });
    expect(message.contactValue().phoneCountryCode).toBe('+52');
  });

  it('rechaza una fecha de inicio inválida', () => {
    expect(
      () =>
        new RequestPublicBookingMessage({
          slug: AGENDA_SLUG,
          fullName: 'Juana Pérez',
          startAtIso: 'no-es-fecha',
        }),
    ).toThrow(InvalidBookingDataError);
  });
});
