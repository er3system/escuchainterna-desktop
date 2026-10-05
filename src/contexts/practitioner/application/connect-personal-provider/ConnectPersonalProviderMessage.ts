import { UUID } from '@haskou/value-objects';
import { PersonalProviderCredentials } from '../../domain/value-objects/PersonalProviderCredentials';
export class ConnectPersonalProviderMessage {
  public readonly owner: UUID;
  public readonly credentials: PersonalProviderCredentials;
  public constructor(input: { ownerUserId: string; provider: string; apiKey: string; model: string; sender: string; authorized: boolean }) {
    this.owner = new UUID(input.ownerUserId);
    this.credentials = PersonalProviderCredentials.create(input.provider, input.apiKey, input.model, input.sender, input.authorized);
  }
}
