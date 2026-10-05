import type { DayAvailabilityPrimitives, TimeRangePrimitives } from './value-objects/WeeklyAvailability';

/**
 * Pausa de almuerzo (sugerencia de disponibilidad): resta una ventana del día
 * (ej. 13:00–14:00) de los rangos de disponibilidad, partiéndolos en dos cuando
 * la ventana queda en medio. No es un dato nuevo: el resultado son los mismos
 * rangos con un hueco, que el buscador de cupos ya respeta. Módulo PURO (sin
 * Node), importable desde el editor (client component).
 */

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function toHHMM(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Resta [lunchFrom, lunchTo) de un rango, devolviendo 0, 1 o 2 trozos válidos. */
function subtractLunch(range: TimeRangePrimitives, lunchFrom: number, lunchTo: number): TimeRangePrimitives[] {
  const from = toMinutes(range.from);
  const to = toMinutes(range.to);
  // Sin traslape: el rango queda igual.
  if (lunchTo <= from || lunchFrom >= to) return [{ from: range.from, to: range.to }];
  const pieces: TimeRangePrimitives[] = [];
  if (from < lunchFrom) pieces.push({ from: toHHMM(from), to: toHHMM(Math.min(lunchFrom, to)) });
  if (to > lunchTo) pieces.push({ from: toHHMM(Math.max(lunchTo, from)), to: toHHMM(to) });
  return pieces.filter((piece) => toMinutes(piece.from) < toMinutes(piece.to));
}

/**
 * Aplica la pausa de almuerzo a los días con disponibilidad. Devuelve una copia
 * nueva; los días que se quedan sin rangos se omiten. Si la ventana es inválida
 * (inicio ≥ fin), regresa el valor sin cambios.
 */
export function applyLunchBreak(
  value: DayAvailabilityPrimitives[],
  lunch: { from: string; to: string },
): DayAvailabilityPrimitives[] {
  const lunchFrom = toMinutes(lunch.from);
  const lunchTo = toMinutes(lunch.to);
  if (!Number.isFinite(lunchFrom) || !Number.isFinite(lunchTo) || lunchFrom >= lunchTo) {
    return value;
  }
  return value
    .map((entry) => ({
      day: entry.day,
      ranges: entry.ranges.flatMap((range) => subtractLunch(range, lunchFrom, lunchTo)),
    }))
    .filter((entry) => entry.ranges.length > 0);
}
