import type { UUID } from '@haskou/value-objects';
import type { PersonalProviderCredentials } from '../value-objects/PersonalProviderCredentials';
import type { PersonalProviderName } from '../personalProviders';
export interface PersonalProviderRepository {
  save(owner: UUID, credentials: PersonalProviderCredentials): Promise<void>;
  disconnect(owner: UUID, provider: PersonalProviderName): Promise<void>;
}
