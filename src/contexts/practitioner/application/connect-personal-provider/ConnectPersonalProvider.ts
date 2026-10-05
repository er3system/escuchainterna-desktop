import type { PersonalProviderRepository } from '../../domain/repositories/PersonalProviderRepository';
import type { ConnectPersonalProviderMessage } from './ConnectPersonalProviderMessage';
import type { DisconnectPersonalProviderMessage } from './DisconnectPersonalProviderMessage';
export class ConnectPersonalProvider {
  public constructor(private readonly repository: PersonalProviderRepository) {}
  public async connect(message: ConnectPersonalProviderMessage): Promise<void> { await this.repository.save(message.owner, message.credentials); }
  public async disconnect(message: DisconnectPersonalProviderMessage): Promise<void> { await this.repository.disconnect(message.owner, message.provider); }
}
