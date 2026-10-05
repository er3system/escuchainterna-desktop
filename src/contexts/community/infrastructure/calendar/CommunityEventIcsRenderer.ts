import { CommunityEventPrimitives } from '../../domain/CommunityEvent';

const EVENT_DURATION_MS = 60 * 60 * 1000; // los eventos de comunidad duran 1 hora

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Genera el archivo .ics (RFC 5545) para "Agregar a mi calendario". */
export class CommunityEventIcsRenderer {
  public render(event: CommunityEventPrimitives): string {
    const start = new Date(event.startsAt);
    const end = new Date(start.getTime() + EVENT_DURATION_MS);
    const description = [event.description, event.speaker ? `Ponente: ${event.speaker}` : '']
      .filter(Boolean)
      .join('\n');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EscuchaInterna//Comunidad//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@escuchainterna.local`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
    ];
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    if (event.link) lines.push(`URL:${event.link}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
  }
}
