import { Email } from '@haskou/value-objects';
import { TermsNotAcceptedError } from '../../domain/errors/TermsNotAcceptedError';
import { assertStrongPassword } from '../../domain/value-objects/passwordPolicy';

export class RegisterPractitionerMessage {
  private readonly email: Email;
  private readonly plainPassword: string;
  private readonly name: string;
  private readonly dialCode: string;
  private readonly phone: string;
  private readonly refCode: string | null;

  public constructor(input: {
    fullName: string;
    email: string;
    password: string;
    phoneDialCode: string;
    phoneNumber: string;
    acceptedTerms: boolean;
    /** Código de referido del link /registro?ref=CODIGO (v3 §11), opcional. */
    referralCode?: string | null;
  }) {
    if (!input.acceptedTerms) throw new TermsNotAcceptedError();
    this.email = new Email(input.email.trim().toLowerCase());
    assertStrongPassword(input.password);
    this.plainPassword = input.password;
    this.name = input.fullName.trim();
    if (!this.name) throw new Error('El nombre completo es obligatorio.');
    this.dialCode = input.phoneDialCode.trim() || '+57';
    this.phone = input.phoneNumber.trim();
    const ref = (input.referralCode ?? '').trim().toUpperCase();
    this.refCode = ref.length > 0 ? ref : null;
  }

  public emailValue(): string {
    return this.email.toString();
  }

  public password(): string {
    return this.plainPassword;
  }

  public fullName(): string {
    return this.name;
  }

  public phoneDialCode(): string {
    return this.dialCode;
  }

  public phoneNumber(): string {
    return this.phone;
  }

  /** Código de referido normalizado (mayúsculas) o null si no vino. */
  public referralCode(): string | null {
    return this.refCode;
  }
}
