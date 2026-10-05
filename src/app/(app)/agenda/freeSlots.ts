/**
 * Cálculo de HUECOS libres del día: a partir de los rangos de disponibilidad del
 * profesional, resta los intervalos ocupados (citas + bloqueos) y descarta lo
 * anterior a `fromMin` (p. ej. "ahora"), devolviendo solo huecos de al menos
 * `minGapMin` minutos. Puro y determinista (minutos desde medianoche), testeable.
 */

export interface FreeGap {
  from: string; // 'HH:mm'
  to: string; // 'HH:mm'
}

export interface BusyInterval {
  start: number; // minutos desde medianoche
  end: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeFreeGaps(
  availabilityRanges: Array<{ from: string; to: string }>,
  busy: BusyInterval[],
  fromMin: number,
  minGapMin = 30,
): FreeGap[] {
  const busyNorm = busy
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  const gaps: FreeGap[] = [];
  for (const range of availabilityRanges) {
    const rangeEnd = toMinutes(range.to);
    let cursor = Math.max(toMinutes(range.from), fromMin);
    if (cursor >= rangeEnd) continue;
    for (const interval of busyNorm) {
      if (interval.end <= cursor) continue;
      if (interval.start >= rangeEnd) break;
      if (interval.start > cursor) {
        const gapEnd = Math.min(interval.start, rangeEnd);
        if (gapEnd - cursor >= minGapMin) gaps.push({ from: toHHMM(cursor), to: toHHMM(gapEnd) });
      }
      cursor = Math.max(cursor, interval.end);
      if (cursor >= rangeEnd) break;
    }
    if (cursor < rangeEnd && rangeEnd - cursor >= minGapMin) {
      gaps.push({ from: toHHMM(cursor), to: toHHMM(rangeEnd) });
    }
  }
  return gaps;
}
