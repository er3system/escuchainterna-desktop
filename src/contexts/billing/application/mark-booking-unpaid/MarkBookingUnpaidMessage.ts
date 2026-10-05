export class MarkBookingUnpaidMessage {
  private readonly id: string;

  public constructor(input: { bookingId: string }) {
    const bookingId = input.bookingId.trim();
    if (!bookingId) throw new Error('Falta el identificador de la reservación.');
    this.id = bookingId;
  }

  public bookingId(): string {
    return this.id;
  }
}
