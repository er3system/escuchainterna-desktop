import type { SecretsPolicy } from '../../domain/RelationalCase';
import { RelationalCaseNotFoundError } from '../../domain/errors/RelationalCaseErrors';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

/** Fija la política de secretos del caso (obligatoria antes de la 1ª sesión individual). */
export class SetSecretsPolicy {
  public constructor(private readonly cases: RelationalCaseRepository) {}

  public async execute(caseId: string, policy: SecretsPolicy): Promise<void> {
    const relationalCase = await this.cases.findById(caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(caseId);
    relationalCase.setSecretsPolicy(policy);
    await this.cases.save(relationalCase);
  }
}
