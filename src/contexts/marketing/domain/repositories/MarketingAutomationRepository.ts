import { AutomationKind, MarketingAutomation } from '../MarketingAutomation';

export interface MarketingAutomationRepository {
  listAll(): Promise<MarketingAutomation[]>;
  /** Siempre devuelve la personalización del owner o su default integrado desactivado. */
  findByKind(kind: AutomationKind): Promise<MarketingAutomation>;
  save(automation: MarketingAutomation): Promise<void>;
}
