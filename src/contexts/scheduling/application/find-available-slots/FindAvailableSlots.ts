import { addDays, addHours, format } from 'date-fns';
import { WeeklyAvailability } from '../../domain/value-objects/WeeklyAvailability';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';
import type { SchedulingSettings } from '../../domain/SchedulingSettings';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import type { FindAvailableSlotsQuery } from './FindAvailableSlotsQuery';

export interface DayAvailableSlots {
  /** Fecha 'yyyy-MM-dd'. */
  date: string;
  /** Horas de inicio disponibles 'HH:mm'. */
  slots: string[];
}

/**
 * Disponibilidad efectiva − reservas no canceladas (con su colchón) − colchón de
 * horas mínimas. Devuelve, por día, las horas de inicio reservables.
 *
 * Cada sesión OCUPA su duración + el colchón (bufferMinutes) que se reserva
 * después para notas o descanso. Un slot candidato (alineado al intervalo desde
 * el inicio del rango) se descarta si el bloque que ocuparía (duración + colchón)
 * se solapa con el bloque ocupado de una reserva existente. Así pueden surgir
 * horarios como 09:15 o 10:30 según el intervalo y el colchón.
 */
export class FindAvailableSlots {
  /**
   * `blockedSlots` es opcional: si se omite, no se descuentan bloqueos (el
   * comportamiento histórico). En producción la fábrica SIEMPRE lo inyecta.
   */
  public constructor(
    private readonly agendas: AgendaRepository,
    private readonly bookings: BookingRepository,
    private readonly settings: SchedulingSettings,
    private readonly blockedSlots?: BlockedSlotRepository,
  ) {}

  public async find(query: FindAvailableSlotsQuery, now: Date = new Date()): Promise<DayAvailableSlots[]> {
    const agenda = await this.agendas.findById(query.agendaIdValue());
    if (!agenda) {
      throw new AgendaNotFoundError(query.agendaIdValue());
    }
    const defaults = await this.settings.getDefaults();
    const availability = agenda.effectiveAvailability(
      WeeklyAvailability.fromPrimitives(defaults.availability),
    );
    const durationMinutes = agenda.sessionDurationMinutes();
    const bufferMinutes = agenda.bufferAfterMinutes();
    const rangeStart = query.fromDate();
    const rangeEnd = addDays(rangeStart, query.daysToExplore());
    const existing = await this.bookings.findActiveBetween(rangeStart, rangeEnd);
    // Bloqueos manuales (almuerzo puntual, citas personales, vacaciones): tapan
    // el tiempo igual que una reserva, pero no son de un paciente.
    const blocks = (await this.blockedSlots?.findBetween(rangeStart, rangeEnd)) ?? [];
    const bookableFrom = addHours(now, agenda.minimumBookingHours());

    const result: DayAvailableSlots[] = [];
    for (let i = 0; i < query.daysToExplore(); i += 1) {
      const day = addDays(rangeStart, i);
      // Candidatos: la sesión completa cabe en el rango; avanzan en pasos de slotInterval.
      const startTimes = availability.slotStartsForDay(day.getDay(), durationMinutes, agenda.slotInterval());
      const slots = startTimes.filter((startTime) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const slotStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
        if (slotStart.getTime() < bookableFrom.getTime()) return false;
        // El bloque ocupado por la nueva sesión incluye su colchón posterior.
        const slotOccupiedEnd = agenda.occupiedEndFor(slotStart);
        // Un espacio bloqueado manualmente descarta el slot que lo toque.
        if (blocks.some((block) => block.overlaps(slotStart, slotOccupiedEnd))) return false;
        // Cada reserva existente también reserva su propio colchón hacia adelante,
        // así queda al menos `bufferMinutes` libres entre dos sesiones.
        return !existing.some((booking) =>
          booking.overlaps(slotStart, slotOccupiedEnd) ||
          (bufferMinutes > 0 &&
            booking.overlapsOccupied(slotStart, slotOccupiedEnd, bufferMinutes)),
        );
      });
      result.push({ date: format(day, 'yyyy-MM-dd'), slots });
    }
    return result;
  }
}
