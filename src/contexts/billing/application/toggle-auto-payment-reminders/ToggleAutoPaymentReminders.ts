import { BillingProfileRepository } from '../../domain/repositories/BillingProfileRepository';

export class ToggleAutoPaymentReminders {
  public constructor(private readonly profiles: BillingProfileRepository) {}

  public async toggle(enabled: boolean): Promise<void> {
    await this.profiles.setAutoPaymentReminders(enabled);
  }
}
