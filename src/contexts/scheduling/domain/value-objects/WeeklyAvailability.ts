import { Hour } from '@haskou/value-objects';
import { InvalidWeeklyAvailabilityError } from '../errors/InvalidWeeklyAvailabilityError';

export interface TimeRangePrimitives {
  from: string; // 'HH:mm'
  to: string; // 'HH:mm'
}

export interface DayAvailabilityPrimitives {
  day: number; // 0 (domingo) .. 6 (sábado) — convención de Date.getDay()
  ranges: TimeRangePrimitives[];
}

interface HourRange {
  from: Hour;
  to: Hour;
}

/**
 * Disponibilidad semanal: rangos horarios por día de la semana.
 * Convención de días: 0 = domingo … 6 = sábado (igual que Date.getDay()).
 */
export class WeeklyAvailability {
  private constructor(private readonly rangesByDay: Map<number, HourRange[]>) {}

  public static fromPrimitives(primitives: DayAvailabilityPrimitives[]): WeeklyAvailability {
    const rangesByDay = new Map<number, HourRange[]>();
    for (const dayAvailability of primitives) {
      const day = dayAvailability.day;
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new InvalidWeeklyAvailabilityError(
          `el día debe ser un entero entre 0 (domingo) y 6 (sábado), se recibió ${day}`,
        );
      }
      if (rangesByDay.has(day)) {
        throw new InvalidWeeklyAvailabilityError(`el día ${day} está duplicado`);
      }
      const ranges = dayAvailability.ranges
        .map((range) => WeeklyAvailability.parseRange(range))
        .sort((a, b) => WeeklyAvailability.minutesOf(a.from) - WeeklyAvailability.minutesOf(b.from));
      for (let i = 1; i < ranges.length; i += 1) {
        if (ranges[i].from.isLessThan(ranges[i - 1].to)) {
          throw new InvalidWeeklyAvailabilityError(`los rangos del día ${day} se solapan`);
        }
      }
      if (ranges.length > 0) {
        rangesByDay.set(day, ranges);
      }
    }
    return new WeeklyAvailability(rangesByDay);
  }

  public static empty(): WeeklyAvailability {
    return new WeeklyAvailability(new Map());
  }

  public isEmpty(): boolean {
    return this.rangesByDay.size === 0;
  }

  /**
   * Indica si una sesión que inicia en `date` y dura `durationMinutes`
   * cabe completa dentro de algún rango del día correspondiente.
   */
  public isAvailableAt(date: Date, durationMinutes: number): boolean {
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return false;
    const ranges = this.rangesByDay.get(date.getDay());
    if (!ranges) return false;
    const start = new Hour(date.getHours(), date.getMinutes());
    return ranges.some((range) => {
      if (start.isLessThan(range.from)) return false;
      const totalRangeMinutes = range.from.diffInMinutes(range.to);
      const offsetMinutes = range.from.diffInMinutes(start);
      return offsetMinutes + durationMinutes <= totalRangeMinutes;
    });
  }

  /**
   * Horas de inicio ('HH:mm') posibles para un día de la semana, avanzando en
   * pasos de `intervalMinutes` y exigiendo que la sesión completa quepa en el rango.
   */
  public slotStartsForDay(day: number, durationMinutes: number, intervalMinutes: number): string[] {
    if (durationMinutes <= 0 || intervalMinutes <= 0) return [];
    const ranges = this.rangesByDay.get(day);
    if (!ranges) return [];
    const slots: string[] = [];
    for (const range of ranges) {
      const totalRangeMinutes = range.from.diffInMinutes(range.to);
      for (let offset = 0; offset + durationMinutes <= totalRangeMinutes; offset += intervalMinutes) {
        slots.push(range.from.addMinutes(offset).toString());
      }
    }
    return slots;
  }

  public toPrimitives(): DayAvailabilityPrimitives[] {
    return [...this.rangesByDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, ranges]) => ({
        day,
        ranges: ranges.map((range) => ({ from: range.from.toString(), to: range.to.toString() })),
      }));
  }

  private static parseRange(range: TimeRangePrimitives): HourRange {
    let from: Hour;
    let to: Hour;
    try {
      from = new Hour(range.from);
      to = new Hour(range.to);
    } catch {
      throw new InvalidWeeklyAvailabilityError(`rango horario inválido «${range.from}–${range.to}»`);
    }
    if (!from.isLessThan(to)) {
      throw new InvalidWeeklyAvailabilityError(
        `el inicio (${range.from}) debe ser anterior al fin (${range.to})`,
      );
    }
    return { from, to };
  }

  private static minutesOf(hour: Hour): number {
    return hour.getHours() * 60 + hour.getMinutes();
  }
}
