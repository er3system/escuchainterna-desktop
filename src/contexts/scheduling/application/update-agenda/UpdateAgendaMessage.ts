import { CreateAgendaMessage } from '../create-agenda/CreateAgendaMessage';
import type { CreateAgendaInput } from '../create-agenda/CreateAgendaMessage';
import { InvalidAgendaConfigurationError } from '../../domain/errors/InvalidAgendaConfigurationError';

export interface UpdateAgendaInput extends CreateAgendaInput {
  id: string;
}

/** Igual que CreateAgendaMessage pero dirigido a una agenda existente. */
export class UpdateAgendaMessage extends CreateAgendaMessage {
  private readonly id: string;

  public constructor(input: UpdateAgendaInput) {
    super(input);
    const id = (input.id ?? '').trim();
    if (!id) {
      throw new InvalidAgendaConfigurationError('se requiere el identificador de la agenda');
    }
    this.id = id;
  }

  public agendaIdValue(): string {
    return this.id;
  }
}
