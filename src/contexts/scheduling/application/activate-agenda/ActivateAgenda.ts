import type { AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import { AgendaNotFoundError } from '../../domain/errors/AgendaNotFoundError';

/** Reactiva una agenda desactivada (contraparte de DeactivateAgenda). */
export class ActivateAgenda {
  public constructor(private readonly agendas: AgendaRepository) {}

  public async activate(agendaId: string): Promise<AgendaPrimitives> {
    const agenda = await this.agendas.findById(agendaId);
    if (!agenda) {
      throw new AgendaNotFoundError(agendaId);
    }
    agenda.activate();
    await this.agendas.save(agenda);
    return agenda.toPrimitives();
  }
}
