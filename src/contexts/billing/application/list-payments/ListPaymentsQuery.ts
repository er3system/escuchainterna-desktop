import { PaymentsLedgerCriteria } from '../../domain/repositories/PaymentsLedger';

function dayStartIso(date: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0).toISOString();
}

function nextDayStartIso(date: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1, 0, 0, 0, 0).toISOString();
}

export class ListPaymentsQuery {
  private constructor(
    private readonly onlyCompleted: boolean,
    private readonly paymentStatus: 'pendiente' | 'pagada' | undefined,
    private readonly fromIso: string | undefined,
    private readonly toIso: string | undefined,
    private readonly tags: string[],
    private readonly text: string,
    private readonly patientId: string,
  ) {}

  public static fromPrimitives(input: {
    onlyCompleted?: string;
    paymentStatus?: string;
    fromDate?: string;
    toDate?: string;
    tags?: string;
    text?: string;
    patientId?: string;
  }): ListPaymentsQuery {
    const status =
      input.paymentStatus === 'pendiente' || input.paymentStatus === 'pagada'
        ? input.paymentStatus
        : undefined;
    const tags = (input.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return new ListPaymentsQuery(
      input.onlyCompleted !== '0', // por defecto solo completadas, como el original
      status,
      input.fromDate ? dayStartIso(input.fromDate) : undefined,
      input.toDate ? nextDayStartIso(input.toDate) : undefined,
      tags,
      (input.text ?? '').trim(),
      (input.patientId ?? '').trim(),
    );
  }

  public toCriteria(): PaymentsLedgerCriteria {
    return {
      onlyCompleted: this.onlyCompleted,
      paymentStatus: this.paymentStatus,
      fromIso: this.fromIso,
      toIso: this.toIso,
      tags: this.tags.length > 0 ? this.tags : undefined,
      text: this.text || undefined,
      patientId: this.patientId || undefined,
    };
  }
}
