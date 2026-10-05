import type { Agenda } from '../Agenda';

export interface AgendaRepository {
  save(agenda: Agenda): Promise<void>;
  findById(id: string): Promise<Agenda | null>;
  findBySlug(slug: string): Promise<Agenda | null>;
  findAll(): Promise<Agenda[]>;
}
