/**
 * Teléfono del paciente. Nunca rechaza el valor (los teléfonos dudosos se
 * conservan tal cual y la UI los marca en rojo): la pregunta de dominio es
 * `isValidForWhatsApp()`. El número se guarda sin prefijo; el indicativo del
 * país viaja aparte en `countryCode` (v2 §6.1) para que los mensajes de
 * WhatsApp salgan con lada+número.
 */
export class PatientPhone {
  private readonly value: string;
  private readonly dialCode: string;

  public constructor(raw: string, countryCode = '+52') {
    this.value = raw.trim();
    this.dialCode = (countryCode ?? '').trim() || '+52';
  }

  public static empty(): PatientPhone {
    return new PatientPhone('');
  }

  /** Indicativo del país (p. ej. «+52»). */
  public countryCodeValue(): string {
    return this.dialCode;
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  /** 10 a 15 dígitos (se toleran espacios, guiones, puntos y paréntesis). */
  public isValidForWhatsApp(): boolean {
    if (this.isEmpty()) return false;
    if (!/^\+?[\d\s\-().]+$/.test(this.value)) return false;
    const digits = this.value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }

  public toString(): string {
    return this.value;
  }
}
