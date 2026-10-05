import { InvalidBlockedSlotError } from './errors/InvalidBlockedSlotError';

export interface BlockedSlotPrimitives {
  id: string;
  /** Inicio del bloqueo (ISO 8601). */
  startAt: string;
  /** Fin del bloqueo (ISO 8601). */
  endAt: string;
  /** Motivo libre del bloqueo (ej. "Almuerzo", "Cita médica"); puede ir vacío. */
  title: string;
  createdAt: string;
}

/**
 * Espacio bloqueado manualmente por el profesional: tiempo NO reservable que no
 * corresponde a un paciente (almuerzo puntual, cita personal, vacaciones…). Es
 * por dueño (owner_user_id), así que tapa la disponibilidad de TODAS sus
 * agendas, no solo de una. No genera notificaciones ni pagos.
 */
export class BlockedSlot {
  private constructor(
    private readonly id: string,
    private readonly startAt: Date,
    private readonly endAt: Date,
    private readonly title: string,
    private readonly createdAt: Date,
  ) {}

  public static create(input: { id: string; startAt: Date; endAt: Date; title?: string }): BlockedSlot {
    if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
      throw new InvalidBlockedSlotError('las fechas son inválidas');
    }
    if (input.endAt.getTime() <= input.startAt.getTime()) {
      throw new InvalidBlockedSlotError('el fin debe ser posterior al inicio');
    }
    return new BlockedSlot(input.id, input.startAt, input.endAt, (input.title ?? '').trim(), new Date());
  }

  public static fromPrimitives(primitives: BlockedSlotPrimitives): BlockedSlot {
    return new BlockedSlot(
      primitives.id,
      new Date(primitives.startAt),
      new Date(primitives.endAt),
      primitives.title,
      new Date(primitives.createdAt),
    );
  }

  public blockedSlotId(): string {
    return this.id;
  }

  public start(): Date {
    return this.startAt;
  }

  public end(): Date {
    return this.endAt;
  }

  public titleValue(): string {
    return this.title;
  }

  /** ¿El bloqueo se empalma con el intervalo [start, end)? */
  public overlaps(start: Date, end: Date): boolean {
    return this.startAt.getTime() < end.getTime() && this.endAt.getTime() > start.getTime();
  }

  public toPrimitives(): BlockedSlotPrimitives {
    return {
      id: this.id,
      startAt: this.startAt.toISOString(),
      endAt: this.endAt.toISOString(),
      title: this.title,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
