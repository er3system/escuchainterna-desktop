import { InvalidConsentSignatureError } from '../../domain/errors/InvalidConsentSignatureError';

export class SignPatientConsentMessage {
  private readonly tokenValue: string;
  private readonly signedNameValue: string;

  public constructor(input: { token: string; signedName: string; accepted: boolean }) {
    const token = (input.token ?? '').trim();
    if (token === '') throw new InvalidConsentSignatureError('La liga de firma no es válida.');
    if (!input.accepted) {
      throw new InvalidConsentSignatureError('Debes marcar la casilla de aceptación para firmar.');
    }
    this.tokenValue = token;
    this.signedNameValue = (input.signedName ?? '').replace(/\s+/g, ' ').trim();
  }

  public token(): string {
    return this.tokenValue;
  }

  public signedName(): string {
    return this.signedNameValue;
  }
}
