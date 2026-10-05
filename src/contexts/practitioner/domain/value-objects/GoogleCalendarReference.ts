import { GoogleCalendarAccessError } from '../errors/GoogleCalendarAccessError';
export class GoogleCalendarReference {
  private constructor(private readonly id: string) {}
  public static create(id: string): GoogleCalendarReference {
    if (!id || id === 'primary' || id.length > 512 || /[\s\x00-\x1f]/.test(id)) throw new GoogleCalendarAccessError('Google no devolvió un calendario válido para la app.');
    return new GoogleCalendarReference(id);
  }
  public toString(): string { return this.id; }
}
