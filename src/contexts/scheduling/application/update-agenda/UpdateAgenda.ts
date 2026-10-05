import type { AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';
import { AgendaSlugAlreadyInUseError } from '../../domain/errors/AgendaSlugAlreadyInUseError';
import type { UpdateAgendaMessage } from './UpdateAgendaMessage';

export class UpdateAgenda {
  public constructor(private readonly agendas: AgendaRepository) {}

  public async update(message: UpdateAgendaMessage): Promise<AgendaPrimitives> {
    const agenda = await this.agendas.findById(message.agendaIdValue());
    if (!agenda) {
      throw new AgendaNotFoundError(message.agendaIdValue());
    }
    const configuration = message.agendaConfiguration();
    const sameSlug = await this.agendas.findBySlug(configuration.slug);
    if (sameSlug && sameSlug.agendaId() !== message.agendaIdValue()) {
      throw new AgendaSlugAlreadyInUseError(configuration.slug);
    }
    agenda.update(configuration);
    await this.agendas.save(agenda);
    return agenda.toPrimitives();
  }
}
