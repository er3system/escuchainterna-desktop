import {
  parseAgendaModality,
  parseAgendaPaymentMode,
} from '../../domain/Agenda';
import type { AgendaConfiguration } from '../../domain/Agenda';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { WeeklyAvailability } from '../../domain/value-objects/WeeklyAvailability';
import type { DayAvailabilityPrimitives } from '../../domain/value-objects/WeeklyAvailability';
import { InvalidAgendaConfigurationError } from '../../domain/errors/InvalidAgendaConfigurationError';

export interface CreateAgendaInput {
  name: string;
  color?: string;
  slug?: string;
  durationMinutes?: number;
  slotIntervalMinutes?: number;
  minBookingHours?: number;
  /** Colchón en minutos tras cada sesión (notas o descanso); 0 = sin colchón. */
  bufferMinutes?: number;
  availabilityOverride?: DayAvailabilityPrimitives[] | null;
  paymentOverride?: {
    price: number;
    paymentMode: string;
    showPrice: boolean;
    showStripeLink?: boolean;
    /** Moneda propia de la agenda; '' u omitida = usar la del perfil. */
    currency?: string;
  } | null;
  locationOverride?: {
    modality: string;
    address?: string;
    mapsUrl?: string;
  } | null;
}

const DEFAULT_COLOR = '#5B5BD6';
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_SLOT_INTERVAL_MINUTES = 60;
const DEFAULT_MIN_BOOKING_HOURS = 8;
const DEFAULT_BUFFER_MINUTES = 0;

/** Convierte una sola vez los primitivos del formulario de agenda a la configuración del dominio. */
export class CreateAgendaMessage {
  private readonly configuration: AgendaConfiguration;

  public constructor(input: CreateAgendaInput) {
    const name = (input.name ?? '').trim();
    if (!name) {
      throw new InvalidAgendaConfigurationError('el nombre es obligatorio');
    }
    const slugSource = (input.slug ?? '').trim() || name;
    this.configuration = {
      name,
      color: (input.color ?? '').trim() || DEFAULT_COLOR,
      slug: CreateAgendaMessage.slugify(slugSource),
      durationMinutes: Math.trunc(input.durationMinutes ?? DEFAULT_DURATION_MINUTES),
      slotIntervalMinutes: Math.trunc(input.slotIntervalMinutes ?? DEFAULT_SLOT_INTERVAL_MINUTES),
      minBookingHours: Math.trunc(input.minBookingHours ?? DEFAULT_MIN_BOOKING_HOURS),
      bufferMinutes: Math.max(0, Math.trunc(input.bufferMinutes ?? DEFAULT_BUFFER_MINUTES)),
      availabilityOverride: input.availabilityOverride
        ? WeeklyAvailability.fromPrimitives(input.availabilityOverride)
        : null,
      paymentOverride: input.paymentOverride
        ? {
            price: input.paymentOverride.price,
            paymentMode: parseAgendaPaymentMode(input.paymentOverride.paymentMode),
            showPrice: input.paymentOverride.showPrice,
            showStripeLink: input.paymentOverride.showStripeLink ?? false,
            currency: CreateAgendaMessage.parseCurrency(input.paymentOverride.currency),
          }
        : null,
      locationOverride: input.locationOverride
        ? {
            modality: parseAgendaModality(input.locationOverride.modality),
            address: (input.locationOverride.address ?? '').trim(),
            mapsUrl: (input.locationOverride.mapsUrl ?? '').trim(),
          }
        : null,
    };
  }

  public agendaConfiguration(): AgendaConfiguration {
    return this.configuration;
  }

  /** '' = usar la moneda del perfil; cualquier otro valor debe ser un código soportado. */
  private static parseCurrency(value: string | undefined): string {
    const code = (value ?? '').trim().toUpperCase();
    if (code === '') return '';
    if (!SUPPORTED_CURRENCIES.some((currency) => currency.code === code)) {
      throw new InvalidAgendaConfigurationError(`moneda no soportada «${code}»`);
    }
    return code;
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
