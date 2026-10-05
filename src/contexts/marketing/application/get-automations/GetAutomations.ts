import { MarketingAutomationPrimitives } from '../../domain/MarketingAutomation';
import { MarketingAutomationRepository } from '../../domain/repositories/MarketingAutomationRepository';

export class GetAutomations {
  public constructor(private readonly automations: MarketingAutomationRepository) {}

  public async get(): Promise<MarketingAutomationPrimitives[]> {
    const automations = await this.automations.listAll();
    return automations.map((automation) => automation.toPrimitives());
  }
}
