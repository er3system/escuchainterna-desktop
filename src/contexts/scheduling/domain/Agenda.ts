import { addMinutes } from 'date-fns';
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { WeeklyAvailability } from './value-objects/WeeklyAvailability';
import type { DayAvailabilityPrimitives } from './value-objects/WeeklyAvailability';
import { InvalidAgendaConfigurationError } from './errors/InvalidAgendaConfigurationError';

export type AgendaModality = 'presencial' | 'virtual' | 'ambas';
export type AgendaPaymentMode = 'manual' | 'requerido';

export interface AgendaPaymentOverride {
  price: number;
  paymentMode: AgendaPaymentMode;
  showPrice: boolean;
  showStripeLink: boolean;
  /** Moneda propia de la agenda (código ISO); '' = usar la moneda del perfil. */
  currency: string;
}

export interface AgendaLocationOverride {
  modality: AgendaModality;
  address: string;
  mapsUrl: string;
}

export interface PaymentDefaults {
  price: number;
  paymentMode: AgendaPaymentMode;
  showPrice: boolean;
  currency: string;
  /** false impone servicio sin cobro y prevalece sobre cualquier override. */
  paymentsEnabled?: boolean;
}

export interface EffectivePayment {
  price: number;
  paymentMode: AgendaPaymentMode;
  showPrice: boolean;
  showPaymentLink: boolean;
  currency: string;
}

export interface LocationDefaults {
  modality: AgendaModality;
  address: string;
  mapsUrl: string;
}

export type EffectiveLocation = LocationDefaults;

export interface AgendaConfiguration {
  name: string;
  color: string;
  slug: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minBookingHours: number;
  /** Colchón en minutos reservado tras cada sesión (notas o descanso). */
  bufferMinutes: number;
  availabilityOverride: WeeklyAvailability | null;
  paymentOverride: AgendaPaymentOverride | null;
  locationOverride: AgendaLocationOverride | null;
}

export interface AgendaPrimitives {
  id: string;
  name: string;
  color: string;
  slug: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minBookingHours: number;
  /** Colchón en minutos reservado tras cada sesión (notas o descanso). */
  bufferMinutes: number;
  availabilityOverride: DayAvailabilityPrimitives[] | null;
  paymentOverride: AgendaPaymentOverride | null;
  locationOverride: AgendaLocationOverride | null;
  active: boolean;
  createdAt: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseAgendaModality(value: string): AgendaModality {
  if (value === 'presencial' || value === 'virtual' || value === 'ambas') return value;
  throw new InvalidAgendaConfigurationError(`modalidad no soportada «${value}»`);
}

export function parseAgendaPaymentMode(value: string): AgendaPaymentMode {
  if (value === 'manual' || value === 'requerido') return value;
  throw new InvalidAgendaConfigurationError(`modo de pago no soportado «${value}»`);
}

/**
 * Agenda (tipo de sesión reservable): define duración, intervalos, anticipación
 * mínima y overrides opcionales sobre la configuración global del profesional.
 */
export class Agenda extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private name: string,
    private color: string,
    private slug: string,
    private durationMinutes: number,
    private slotIntervalMinutes: number,
    private minBookingHours: number,
    private bufferMinutes: number,
    private availabilityOverride: WeeklyAvailability | null,
    private paymentOverride: AgendaPaymentOverride | null,
    private locationOverride: AgendaLocationOverride | null,
    private active: boolean,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static create(id: string, configuration: AgendaConfiguration): Agenda {
    Agenda.ensureIsValid(configuration);
    return new Agenda(
      id,
      configuration.name,
      configuration.color,
      configuration.slug,
      configuration.durationMinutes,
      configuration.slotIntervalMinutes,
      configuration.minBookingHours,
      configuration.bufferMinutes,
      configuration.availabilityOverride,
      configuration.paymentOverride,
      configuration.locationOverride,
      true,
      new Date(),
    );
  }

  public static fromPrimitives(primitives: AgendaPrimitives): Agenda {
    return new Agenda(
      primitives.id,
      primitives.name,
      primitives.color,
      primitives.slug,
      primitives.durationMinutes,
      primitives.slotIntervalMinutes,
      primitives.minBookingHours,
      primitives.bufferMinutes,
      primitives.availabilityOverride
        ? WeeklyAvailability.fromPrimitives(primitives.availabilityOverride)
        : null,
      primitives.paymentOverride,
      primitives.locationOverride,
      primitives.active,
      new Date(primitives.createdAt),
    );
  }

  public update(configuration: AgendaConfiguration): void {
    Agenda.ensureIsValid(configuration);
    this.name = configuration.name;
    this.color = configuration.color;
    this.slug = configuration.slug;
    this.durationMinutes = configuration.durationMinutes;
    this.slotIntervalMinutes = configuration.slotIntervalMinutes;
    this.minBookingHours = configuration.minBookingHours;
    this.bufferMinutes = configuration.bufferMinutes;
    this.availabilityOverride = configuration.availabilityOverride;
    this.paymentOverride = configuration.paymentOverride;
    this.locationOverride = configuration.locationOverride;
  }

  public deactivate(): void {
    this.active = false;
  }

  public activate(): void {
    this.active = true;
  }

  public isActive(): boolean {
    return this.active;
  }

  public agendaId(): string {
    return this.id;
  }

  public slugValue(): string {
    return this.slug;
  }

  public sessionDurationMinutes(): number {
    return this.durationMinutes;
  }

  public slotInterval(): number {
    return this.slotIntervalMinutes;
  }

  public minimumBookingHours(): number {
    return this.minBookingHours;
  }

  /** Colchón en minutos reservado tras cada sesión (notas o descanso). */
  public bufferAfterMinutes(): number {
    return this.bufferMinutes;
  }

  /** Liga pública de reservas de esta agenda. */
  public publicPath(): string {
    return `/reservar/${this.slug}`;
  }

  /** Fin de una sesión que inicia en `start`, según la duración configurada. */
  public endFor(start: Date): Date {
    return addMinutes(start, this.durationMinutes);
  }

  /**
   * Fin del bloque OCUPADO por una sesión que inicia en `start`: duración + colchón.
   * Se usa para calcular disponibilidad (un slot nuevo no puede empezar antes de esto).
   */
  public occupiedEndFor(start: Date): Date {
    return addMinutes(start, this.durationMinutes + this.bufferMinutes);
  }

  public effectiveAvailability(globalAvailability: WeeklyAvailability): WeeklyAvailability {
    return this.availabilityOverride ?? globalAvailability;
  }

  public effectivePrice(globalDefaults: PaymentDefaults): EffectivePayment {
    if (globalDefaults.paymentsEnabled === false) {
      return {
        price: 0,
        paymentMode: 'manual',
        showPrice: false,
        showPaymentLink: false,
        currency: globalDefaults.currency,
      };
    }
    if (this.paymentOverride) {
      return {
        price: this.paymentOverride.price,
        paymentMode: this.paymentOverride.paymentMode,
        showPrice: this.paymentOverride.showPrice,
        showPaymentLink: this.paymentOverride.showStripeLink,
        currency: this.effectiveCurrency(globalDefaults.currency),
      };
    }
    return {
      price: globalDefaults.price,
      paymentMode: globalDefaults.paymentMode,
      showPrice: globalDefaults.showPrice,
      showPaymentLink: false,
      currency: this.effectiveCurrency(globalDefaults.currency),
    };
  }

  /** Moneda efectiva de la agenda: el override de pago ('' = perfil) o la global. */
  public effectiveCurrency(globalCurrency: string): string {
    return this.paymentOverride?.currency || globalCurrency;
  }

  public effectiveLocation(globalDefaults: LocationDefaults): EffectiveLocation {
    if (this.locationOverride) {
      return {
        modality: this.locationOverride.modality,
        address: this.locationOverride.address,
        mapsUrl: this.locationOverride.mapsUrl,
      };
    }
    return {
      modality: globalDefaults.modality,
      address: globalDefaults.address,
      mapsUrl: globalDefaults.mapsUrl,
    };
  }

  public toPrimitives(): AgendaPrimitives {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      slug: this.slug,
      durationMinutes: this.durationMinutes,
      slotIntervalMinutes: this.slotIntervalMinutes,
      minBookingHours: this.minBookingHours,
      bufferMinutes: this.bufferMinutes,
      availabilityOverride: this.availabilityOverride ? this.availabilityOverride.toPrimitives() : null,
      paymentOverride: this.paymentOverride ? { ...this.paymentOverride } : null,
      locationOverride: this.locationOverride ? { ...this.locationOverride } : null,
      active: this.active,
      createdAt: this.createdAt.toISOString(),
    };
  }

  private static ensureIsValid(configuration: AgendaConfiguration): void {
    if (!configuration.name.trim()) {
      throw new InvalidAgendaConfigurationError('el nombre es obligatorio');
    }
    if (!SLUG_PATTERN.test(configuration.slug)) {
      throw new InvalidAgendaConfigurationError(
        `la liga «${configuration.slug}» solo puede contener minúsculas, números y guiones`,
      );
    }
    if (!Number.isInteger(configuration.durationMinutes) || configuration.durationMinutes <= 0) {
      throw new InvalidAgendaConfigurationError('la duración debe ser un entero positivo de minutos');
    }
    if (!Number.isInteger(configuration.slotIntervalMinutes) || configuration.slotIntervalMinutes <= 0) {
      throw new InvalidAgendaConfigurationError('el intervalo entre slots debe ser un entero positivo');
    }
    if (!Number.isInteger(configuration.minBookingHours) || configuration.minBookingHours < 0) {
      throw new InvalidAgendaConfigurationError('las horas mínimas para agendar no pueden ser negativas');
    }
    if (!Number.isInteger(configuration.bufferMinutes) || configuration.bufferMinutes < 0) {
      throw new InvalidAgendaConfigurationError('el colchón entre sesiones no puede ser negativo');
    }
    if (configuration.paymentOverride && configuration.paymentOverride.price < 0) {
      throw new InvalidAgendaConfigurationError('el precio no puede ser negativo');
    }
  }
}
