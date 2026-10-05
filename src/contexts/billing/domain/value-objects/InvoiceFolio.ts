const FOLIO_PATTERN = /^EI-(\d{4})-(\d{4,})$/;

/**
 * Folio consecutivo de factura de EscuchaInterna: `EI-<año>-<secuencia>`
 * (v2-spec §6.13). La secuencia es por profesional y por año.
 */
export class InvoiceFolio {
  private constructor(private readonly value: string) {}

  public static generate(year: number, sequence: number): InvoiceFolio {
    if (!Number.isInteger(year) || year < 2000 || year > 9999) {
      throw new Error(`Año inválido para el folio de factura: ${year}.`);
    }
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error(`Secuencia inválida para el folio de factura: ${sequence}.`);
    }
    return new InvoiceFolio(`EI-${year}-${String(sequence).padStart(4, '0')}`);
  }

  public static fromString(value: string): InvoiceFolio {
    if (!FOLIO_PATTERN.test(value)) {
      throw new Error(`Folio de factura inválido: «${value}».`);
    }
    return new InvoiceFolio(value);
  }

  public valueOf(): string {
    return this.value;
  }
}
