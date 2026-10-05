import { addMinutes, differenceInMinutes } from 'date-fns';
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { SessionBookedEvent } from './events/SessionBookedEvent';
import { SessionRescheduledEvent } from './events/SessionRescheduledEvent';
import { SessionCancelledEvent } from './events/SessionCancelledEvent';
import { CancellationWindowClosedError } from './errors/CancellationWindowClosedError';
import { InvalidBookingTransitionError } from './errors/InvalidBookingTransitionError';
import { InvalidBookingPeriodError } from './errors/InvalidBookingPeriodError';
import { InvalidBookingDataError } from './errors/InvalidBookingDataError';

export type BookingStatus = 'agendada' | 'confirmada' | 'completada' | 'cancelada' | 'inasistencia';
export type BookingPaymentStatus = 'pendiente' | 'pagada';
export type BookingModality = 'presencial' | 'virtual';
export type BookingActor = 'profesional' | 'paciente';
export type BookingPaymentMethod = 'transferencia' | 'efectivo' | 'tarjeta' | 'stripe';
export type BookingFeeReason = '' | 'inasistencia' | 'cancelacion_tardia';

/** Tarifa por inasistencia/cancelación tardía configurada en el perfil (spec v2 §6.3). */
export interface BookingPenaltyFee {
  enabled: boolean;
  amount: number;
}

export interface BookingPrimitives {
  id: string;
  agendaId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  price: number;
  /** Moneda del cobro de ESTA sesión (código ISO, p. ej. 'MXN'). */
  currency: string;
  modality: BookingModality;
  meetUrl: string | null;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  paymentMethod: BookingPaymentMethod | null;
  paidAt: string | null;
  recurrenceId: string | null;
  bookedBy: BookingActor;
  rescheduleCount: number;
  /** Tarifa cobrada por inasistencia o cancelación tardía (0 = sin tarifa). */
  feeCharged: number;
  feeReason: BookingFeeReason;
  /** Nota del paciente al agendar (motivo de consulta en sus palabras); '' = sin nota. */
  patientNote: string;
  createdAt: string;
}

export function parseBookingModality(value: string): BookingModality {
  if (value === 'presencial' || value === 'virtual') return value;
  throw new InvalidBookingDataError(`modalidad no soportada «${value}»`);
}

export function parseBookingActor(value: string): BookingActor {
  if (value === 'profesional' || value === 'paciente') return value;
  throw new InvalidBookingDataError(`actor no soportado «${value}»`);
}

export function parseBookingPaymentMethod(value: string): BookingPaymentMethod {
  if (value === 'transferencia' || value === 'efectivo' || value === 'tarjeta' || value === 'stripe') {
    return value;
  }
  throw new InvalidBookingDataError(`método de pago no soportado «${value}»`);
}

/** Reservación de una sesión: paciente + agenda + horario + pago + ciclo de vida. */
export class Booking extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly agendaId: string,
    private readonly patientId: string,
    private startAt: Date,
    private endAt: Date,
    private readonly price: number,
    private readonly currency: string,
    private readonly modality: BookingModality,
    private readonly meetUrl: string | null,
    private status: BookingStatus,
    private paymentStatus: BookingPaymentStatus,
    private paymentMethod: BookingPaymentMethod | null,
    private paidAt: Date | null,
    private readonly recurrenceId: string | null,
    private readonly bookedBy: BookingActor,
    private rescheduleCount: number,
    private feeCharged: number,
    private feeReason: BookingFeeReason,
    private readonly patientNote: string,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static create(input: {
    id: string;
    agendaId: string;
    patientId: string;
    startAt: Date;
    endAt: Date;
    price: number;
    currency: string;
    modality: BookingModality;
    meetUrl: string | null;
    recurrenceId: string | null;
    bookedBy: BookingActor;
    /** Nota del paciente al agendar (opcional). */
    patientNote?: string;
  }): Booking {
    if (input.endAt.getTime() <= input.startAt.getTime()) {
      throw new InvalidBookingPeriodError();
    }
    if (!input.currency.trim()) {
      throw new InvalidBookingDataError('la moneda del cobro es obligatoria');
    }
    const booking = new Booking(
      input.id,
      input.agendaId,
      input.patientId,
      input.startAt,
      input.endAt,
      input.price,
      input.currency,
      input.modality,
      input.meetUrl,
      'agendada',
      'pendiente',
      null,
      null,
      input.recurrenceId,
      input.bookedBy,
      0,
      0,
      '',
      (input.patientNote ?? '').trim(),
      new Date(),
    );
    booking.record(new SessionBookedEvent(input.id, input.patientId, input.startAt));
    return booking;
  }

  public static fromPrimitives(primitives: BookingPrimitives): Booking {
    return new Booking(
      primitives.id,
      primitives.agendaId,
      primitives.patientId,
      new Date(primitives.startAt),
      new Date(primitives.endAt),
      primitives.price,
      primitives.currency,
      primitives.modality,
      primitives.meetUrl,
      primitives.status,
      primitives.paymentStatus,
      primitives.paymentMethod,
      primitives.paidAt ? new Date(primitives.paidAt) : null,
      primitives.recurrenceId,
      primitives.bookedBy,
      primitives.rescheduleCount,
      primitives.feeCharged,
      primitives.feeReason,
      primitives.patientNote ?? '',
      new Date(primitives.createdAt),
    );
  }

  public bookingId(): string {
    return this.id;
  }

  public agendaReference(): string {
    return this.agendaId;
  }

  public patientReference(): string {
    return this.patientId;
  }

  /** Nota del paciente al agendar (motivo en sus palabras); '' = sin nota. */
  public patientNoteValue(): string {
    return this.patientNote;
  }

  public durationMinutes(): number {
    return differenceInMinutes(this.endAt, this.startAt);
  }

  public overlaps(start: Date, end: Date): boolean {
    return this.startAt.getTime() < end.getTime() && this.endAt.getTime() > start.getTime();
  }

  /**
   * ¿El intervalo [start, end) se solapa con el bloque OCUPADO por esta reserva,
   * es decir su sesión más `bufferMinutes` de colchón posterior? Sirve para
   * exigir un colchón mínimo libre entre sesiones al calcular disponibilidad.
   */
  public overlapsOccupied(start: Date, end: Date, bufferMinutes: number): boolean {
    const occupiedEnd = addMinutes(this.endAt, Math.max(0, bufferMinutes));
    return this.startAt.getTime() < end.getTime() && occupiedEnd.getTime() > start.getTime();
  }

  public isActive(): boolean {
    return this.status !== 'cancelada';
  }

  public canReceiveReminder(): boolean {
    return this.status === 'agendada' || this.status === 'confirmada';
  }

  public confirm(): void {
    this.ensureIsOpen('confirmar');
    this.status = 'confirmada';
  }

  public complete(): void {
    this.ensureIsOpen('completar');
    this.status = 'completada';
  }

  /**
   * Marca la inasistencia. Si el perfil tiene activada la tarifa por
   * inasistencia, la sesión queda con esa tarifa como monto por cobrar.
   */
  public markAsNoShow(noShowFee?: BookingPenaltyFee): void {
    this.ensureIsOpen('marcar inasistencia en');
    this.status = 'inasistencia';
    if (noShowFee?.enabled && noShowFee.amount > 0) {
      this.feeCharged = noShowFee.amount;
      this.feeReason = 'inasistencia';
    }
  }

  /**
   * Cancela la sesión. Si cancela el paciente y faltan menos de `minCancellationHours`
   * horas para el inicio, la ventana está cerrada y se rechaza. Si la cancelación
   * ocurre dentro de la ventana mínima (la registra el profesional) y la tarifa por
   * cancelación tardía está activa, la sesión guarda esa tarifa como monto por cobrar.
   */
  public cancel(
    actor: BookingActor,
    minCancellationHours: number,
    now: Date = new Date(),
    lateCancelFee?: BookingPenaltyFee,
  ): void {
    this.ensureIsOpen('cancelar');
    this.ensurePatientWindowIsOpen(actor, minCancellationHours, 'cancelar', now);
    this.status = 'cancelada';
    if (
      lateCancelFee?.enabled &&
      lateCancelFee.amount > 0 &&
      this.isWithinCancellationWindow(minCancellationHours, now)
    ) {
      this.feeCharged = lateCancelFee.amount;
      this.feeReason = 'cancelacion_tardia';
    }
    this.record(new SessionCancelledEvent(this.id, actor));
  }

  /** Reagenda la sesión: misma regla de ventana para el paciente; reinicia la confirmación. */
  public reschedule(
    newStart: Date,
    newEnd: Date,
    actor: BookingActor,
    minCancellationHours: number,
    now: Date = new Date(),
  ): void {
    this.ensureIsOpen('reagendar');
    this.ensurePatientWindowIsOpen(actor, minCancellationHours, 'reagendar', now);
    if (newEnd.getTime() <= newStart.getTime()) {
      throw new InvalidBookingPeriodError();
    }
    const previousStart = this.startAt;
    this.startAt = newStart;
    this.endAt = newEnd;
    this.rescheduleCount += 1;
    this.status = 'agendada';
    this.record(new SessionRescheduledEvent(this.id, previousStart, newStart));
  }

  public markAsPaid(method: BookingPaymentMethod, paidAt: Date = new Date()): void {
    this.paymentStatus = 'pagada';
    this.paymentMethod = method;
    this.paidAt = paidAt;
  }

  public toPrimitives(): BookingPrimitives {
    return {
      id: this.id,
      agendaId: this.agendaId,
      patientId: this.patientId,
      startAt: this.startAt.toISOString(),
      endAt: this.endAt.toISOString(),
      price: this.price,
      currency: this.currency,
      modality: this.modality,
      meetUrl: this.meetUrl,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      paidAt: this.paidAt ? this.paidAt.toISOString() : null,
      recurrenceId: this.recurrenceId,
      bookedBy: this.bookedBy,
      rescheduleCount: this.rescheduleCount,
      feeCharged: this.feeCharged,
      feeReason: this.feeReason,
      patientNote: this.patientNote,
      createdAt: this.createdAt.toISOString(),
    };
  }

  private ensureIsOpen(action: string): void {
    if (this.status === 'cancelada' || this.status === 'completada' || this.status === 'inasistencia') {
      throw new InvalidBookingTransitionError(action, this.status);
    }
  }

  private ensurePatientWindowIsOpen(
    actor: BookingActor,
    minCancellationHours: number,
    action: string,
    now: Date,
  ): void {
    if (actor !== 'paciente') return;
    if (this.isWithinCancellationWindow(minCancellationHours, now)) {
      throw new CancellationWindowClosedError(action, minCancellationHours);
    }
  }

  /** ¿La sesión está a menos de `minCancellationHours` horas de empezar? */
  private isWithinCancellationWindow(minCancellationHours: number, now: Date): boolean {
    const minutesUntilStart = differenceInMinutes(this.startAt, now);
    return minutesUntilStart < minCancellationHours * 60;
  }
}
