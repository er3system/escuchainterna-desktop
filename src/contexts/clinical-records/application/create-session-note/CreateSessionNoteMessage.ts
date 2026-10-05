import { type SessionKind, isSessionKind, DEFAULT_SESSION_TITLE } from '../../domain/sessionTemplates';

export class CreateSessionNoteMessage {
  private readonly patientIdValue: string;
  private readonly titleValue: string;
  private readonly bookingIdValue: string | null;
  private readonly sessionKindValue: SessionKind;

  public constructor(input: {
    patientId: string;
    title: string;
    bookingId?: string | null;
    sessionKind?: unknown;
  }) {
    if (!input.patientId) throw new Error('Falta el paciente para crear la nota de sesión.');
    this.patientIdValue = input.patientId;
    const title = input.title?.trim() ?? '';
    this.sessionKindValue = isSessionKind(input.sessionKind) ? input.sessionKind : 'seguimiento';
    this.titleValue = title === '' ? DEFAULT_SESSION_TITLE[this.sessionKindValue] : title;
    this.bookingIdValue = input.bookingId && input.bookingId.trim() !== '' ? input.bookingId.trim() : null;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public title(): string {
    return this.titleValue;
  }

  public bookingId(): string | null {
    return this.bookingIdValue;
  }

  public sessionKind(): SessionKind {
    return this.sessionKindValue;
  }
}
