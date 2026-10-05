import { randomUUID } from 'node:crypto';
import { Agenda } from '../../domain/Agenda';
import type { AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import { AgendaSlugAlreadyInUseError } from '../../domain/errors/AgendaSlugAlreadyInUseError';
import type { CreateAgendaMessage } from './CreateAgendaMessage';

export class CreateAgenda {
  public constructor(private readonly agendas: AgendaRepository) {}

  public async create(message: CreateAgendaMessage): Promise<AgendaPrimitives> {
    const configuration = message.agendaConfiguration();
    if (await this.agendas.findBySlug(configuration.slug)) {
      throw new AgendaSlugAlreadyInUseError(configuration.slug);
    }
    const agenda = Agenda.create(randomUUID(), configuration);
    await this.agendas.save(agenda);
    return agenda.toPrimitives();
  }
}
