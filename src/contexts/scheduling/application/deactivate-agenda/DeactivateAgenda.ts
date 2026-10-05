import type { AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';

export class DeactivateAgenda {
  public constructor(private readonly agendas: AgendaRepository) {}

  public async deactivate(agendaId: string): Promise<AgendaPrimitives> {
    const agenda = await this.agendas.findById(agendaId);
    if (!agenda) {
      throw new AgendaNotFoundError(agendaId);
    }
    agenda.deactivate();
    await this.agendas.save(agenda);
    return agenda.toPrimitives();
  }
}
