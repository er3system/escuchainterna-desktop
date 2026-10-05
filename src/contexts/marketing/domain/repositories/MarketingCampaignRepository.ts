import { MarketingCampaign } from '../MarketingCampaign';

export interface MarketingCampaignRepository {
  save(campaign: MarketingCampaign): Promise<void>;
  listRecent(limit: number): Promise<MarketingCampaign[]>;
}
