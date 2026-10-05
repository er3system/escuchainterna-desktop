import type { MeetingLinkProvider } from '../../domain/MeetingLinkProvider';

const MEET_BASE = 'https://meet.escuchainterna.local';

/**
 * Adaptador local: liga de videollamada simulada y determinista por reserva.
 * Listo para sustituirse por un adaptador real de Google Meet.
 */
export class LocalMeetingLinkProvider implements MeetingLinkProvider {
  public createMeetingLink(bookingId: string): string {
    const code = bookingId.replace(/-/g, '').slice(0, 8).padEnd(8, '0');
    return `${MEET_BASE}/${code}`;
  }
}
