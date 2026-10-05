/**
 * Puerto para generar ligas de videollamada. El adaptador local genera ligas
 * simuladas; al conectar Google se sustituye por un adaptador de Meet real.
 */
export interface MeetingLinkProvider {
  createMeetingLink(bookingId: string): string;
}
