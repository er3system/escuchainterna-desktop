import type { AssistantRepository } from '../../domain/repositories/AssistantRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import { AssistantNotOwnedError } from './AssistantNotOwnedError';
import { SetAssistantActiveStatusMessage } from './SetAssistantActiveStatusMessage';

/**
 * Desactiva (suspende) o reactiva la cuenta de un asistente (v3 §4). Una
 * cuenta suspendida no puede iniciar sesión (gate del layout privado). Solo
 * el titular que lo dio de alta puede hacerlo.
 */
export class SetAssistantActiveStatus {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly assistants: AssistantRepository,
  ) {}

  public async set(message: SetAssistantActiveStatusMessage): Promise<void> {
    const assistant = await this.assistants.findByAssistantUserId(message.assistantUserId());
    if (!assistant || !assistant.isOwnedBy(message.actorUserId())) {
      throw new AssistantNotOwnedError();
    }

    const account = await this.accounts.findById(message.assistantUserId());
    if (!account) throw new AssistantNotOwnedError();

    if (message.shouldBeActive()) account.reactivate();
    else account.suspend();
    await this.accounts.save(account);
  }
}
