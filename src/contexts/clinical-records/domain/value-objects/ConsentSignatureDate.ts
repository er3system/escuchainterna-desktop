import { InvalidConsentAttachmentError } from '../errors/InvalidConsentAttachmentError';
export class ConsentSignatureDate {
  private readonly date: Date;
  public constructor(raw: string) {
    this.date = new Date(`${raw}T12:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(this.date.getTime()) || this.date.toISOString().slice(0, 10) !== raw || raw > new Date().toISOString().slice(0, 10)) {
      throw new InvalidConsentAttachmentError('Indica la fecha de firma que aparece en el documento, sin fechas futuras.');
    }
  }
  public toDate(): Date { return new Date(this.date); }
  public toString(): string { return this.date.toISOString().slice(0, 10); }
}
