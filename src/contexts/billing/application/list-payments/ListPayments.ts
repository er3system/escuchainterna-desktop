import { PaymentsLedger, PaymentsLedgerPage } from '../../domain/repositories/PaymentsLedger';
import { ListPaymentsQuery } from './ListPaymentsQuery';

export class ListPayments {
  public constructor(private readonly ledger: PaymentsLedger) {}

  public list(query: ListPaymentsQuery): Promise<PaymentsLedgerPage> {
    return this.ledger.search(query.toCriteria());
  }

  public knownTags(): Promise<string[]> {
    return this.ledger.listKnownTags();
  }
}
