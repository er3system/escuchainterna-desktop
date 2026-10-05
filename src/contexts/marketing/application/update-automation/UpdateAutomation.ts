import { MarketingAutomationRepository } from '../../domain/repositories/MarketingAutomationRepository';
import { UpdateAutomationMessage } from './UpdateAutomationMessage';

export class UpdateAutomation {
  public constructor(private readonly automations: MarketingAutomationRepository) {}

  public async update(message: UpdateAutomationMessage): Promise<void> {
    const automation = await this.automations.findByKind(message.kind());
    automation.configure(message.configuration());
    await this.automations.save(automation);
  }
}
