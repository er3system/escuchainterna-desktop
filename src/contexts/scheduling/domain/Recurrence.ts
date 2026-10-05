import { addDays } from 'date-fns';
import { InvalidRecurrenceError } from './errors/InvalidRecurrenceError';

export type RecurrenceFrequency = 'semanal' | 'quincenal';

export interface RecurrencePrimitives {
  id: string;
  frequency: RecurrenceFrequency;
  repeatCount: number;
}

const FREQUENCY_STEP_DAYS: Record<RecurrenceFrequency, number> = {
  semanal: 7,
  quincenal: 14,
};

const MIN_OCCURRENCES = 2;
const MAX_OCCURRENCES = 52;

/** Serie de sesiones recurrentes: frecuencia + número total de repeticiones. */
export class Recurrence {
  private constructor(
    private readonly id: string,
    private readonly frequency: RecurrenceFrequency,
    private readonly repeatCount: number,
  ) {}

  public static create(id: string, frequency: string, repeatCount: number): Recurrence {
    if (frequency !== 'semanal' && frequency !== 'quincenal') {
      throw new InvalidRecurrenceError(`frecuencia no soportada «${frequency}»`);
    }
    if (!Number.isInteger(repeatCount) || repeatCount < MIN_OCCURRENCES || repeatCount > MAX_OCCURRENCES) {
      throw new InvalidRecurrenceError(
        `las repeticiones deben ser un entero entre ${MIN_OCCURRENCES} y ${MAX_OCCURRENCES}`,
      );
    }
    return new Recurrence(id, frequency, repeatCount);
  }

  public static fromPrimitives(primitives: RecurrencePrimitives): Recurrence {
    return new Recurrence(primitives.id, primitives.frequency, primitives.repeatCount);
  }

  public recurrenceId(): string {
    return this.id;
  }

  public occurrences(): number {
    return this.repeatCount;
  }

  /** Expande la serie a las fechas de inicio de cada ocurrencia (incluida la primera). */
  public expandFrom(firstStart: Date): Date[] {
    const step = FREQUENCY_STEP_DAYS[this.frequency];
    const dates: Date[] = [];
    for (let i = 0; i < this.repeatCount; i += 1) {
      dates.push(addDays(firstStart, i * step));
    }
    return dates;
  }

  public toPrimitives(): RecurrencePrimitives {
    return { id: this.id, frequency: this.frequency, repeatCount: this.repeatCount };
  }
}
