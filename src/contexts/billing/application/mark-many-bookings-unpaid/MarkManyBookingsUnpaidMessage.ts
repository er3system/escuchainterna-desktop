export class MarkManyBookingsUnpaidMessage {
  private readonly ids: string[];

  public constructor(input: { bookingIds: string[] }) {
    const ids = Array.from(new Set(input.bookingIds.map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) throw new Error('Selecciona al menos una sesión.');
    this.ids = ids;
  }

  public bookingIds(): string[] {
    return [...this.ids];
  }
}
