import type { AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';

export interface AgendaListItem extends AgendaPrimitives {
  /** Liga pública de reservas: /reservar/<slug>. */
  publicLink: string;
}

export class ListAgendas {
  public constructor(private readonly agendas: AgendaRepository) {}

  public async list(): Promise<AgendaListItem[]> {
    const agendas = await this.agendas.findAll();
    return agendas.map((agenda) => ({
      ...agenda.toPrimitives(),
      publicLink: agenda.publicPath(),
    }));
  }
}
