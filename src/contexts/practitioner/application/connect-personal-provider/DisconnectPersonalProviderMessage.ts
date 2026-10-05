import { UUID } from '@haskou/value-objects';
import { isPersonalProvider, type PersonalProviderName } from '../../domain/personalProviders';
import { InvalidPersonalProviderCredentialsError } from '../../domain/errors/InvalidPersonalProviderCredentialsError';
export class DisconnectPersonalProviderMessage {
  public readonly owner: UUID;
  public readonly provider: PersonalProviderName;
  public constructor(ownerUserId: string, provider: string) {
    this.owner = new UUID(ownerUserId);
    if (!isPersonalProvider(provider)) throw new InvalidPersonalProviderCredentialsError('Proveedor no compatible.');
    this.provider = provider;
  }
}
