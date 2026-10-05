import { randomUUID } from 'node:crypto';
import { RelationalCase, type RelationalCaseKind } from '../../domain/RelationalCase';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

/** Abre un caso relacional (pareja/familia) del dueño. */
export class OpenRelationalCase {
  public constructor(private readonly cases: RelationalCaseRepository) {}

  public async execute(input: {
    ownerUserId: string;
    kind: RelationalCaseKind;
    title: string;
  }): Promise<string> {
    const relationalCase = RelationalCase.open({
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      title: input.title,
    });
    await this.cases.save(relationalCase);
    return relationalCase.caseId();
  }
}
