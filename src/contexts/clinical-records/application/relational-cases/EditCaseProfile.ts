import { randomUUID } from 'node:crypto';
import { RelationalCaseNotFoundError } from '../../domain/errors/RelationalCaseErrors';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';
import type {
  MemberRelationQuality,
  SystemEval,
} from '../../domain/value-objects/caseProfile';

/**
 * Edita el PERFIL clínico de un caso relacional: evaluación del sistema, objetivos,
 * línea de tiempo de eventos y mapa de relaciones entre miembros. Cada operación carga
 * el caso (acotado por dueño), muta el agregado y guarda. Los ids de eventos/relaciones
 * se generan aquí (capa de aplicación).
 */
export class EditCaseProfile {
  public constructor(private readonly cases: RelationalCaseRepository) {}

  private async load(caseId: string) {
    const relationalCase = await this.cases.findById(caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(caseId);
    return relationalCase;
  }

  public async setSystemEval(caseId: string, systemEval: SystemEval): Promise<void> {
    const c = await this.load(caseId);
    c.setSystemEval(systemEval);
    await this.cases.save(c);
  }

  public async setObjectives(caseId: string, objectives: string): Promise<void> {
    const c = await this.load(caseId);
    c.setObjectives(objectives);
    await this.cases.save(c);
  }

  public async addEvent(
    caseId: string,
    input: { date: string; title: string; note: string },
  ): Promise<void> {
    const c = await this.load(caseId);
    c.addEvent({ id: randomUUID(), date: input.date, title: input.title, note: input.note });
    await this.cases.save(c);
  }

  public async removeEvent(caseId: string, eventId: string): Promise<void> {
    const c = await this.load(caseId);
    c.removeEvent(eventId);
    await this.cases.save(c);
  }

  public async upsertRelation(
    caseId: string,
    input: { aMemberId: string; bMemberId: string; quality: MemberRelationQuality; note: string },
  ): Promise<void> {
    if (input.aMemberId === input.bMemberId || !input.aMemberId || !input.bMemberId) {
      throw new Error('La relación debe ser entre dos miembros distintos.');
    }
    const c = await this.load(caseId);
    c.upsertRelation({
      id: randomUUID(),
      aMemberId: input.aMemberId,
      bMemberId: input.bMemberId,
      quality: input.quality,
      note: input.note,
    });
    await this.cases.save(c);
  }

  public async removeRelation(caseId: string, relationId: string): Promise<void> {
    const c = await this.load(caseId);
    c.removeRelation(relationId);
    await this.cases.save(c);
  }
}
