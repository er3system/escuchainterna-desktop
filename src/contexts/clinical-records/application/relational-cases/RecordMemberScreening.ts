import type { ScreeningStatus } from '../../domain/CaseMember';
import {
  CaseMemberNotFoundError,
  RelationalCaseNotFoundError,
} from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

const COERCIVE_CONTRAINDICATION_REASON =
  'Cribado de violencia: patrón de control coercitivo. El formato conjunto está contraindicado; corresponde atención individual por vías separadas, evaluación de riesgo y derivación a los dispositivos de protección.';

/**
 * Registra el resultado del cribado de violencia de un miembro (hecho SIEMPRE por
 * separado, §"cribado de violencia"). Si revela violencia coercitiva, contraindica
 * el caso para el formato conjunto.
 */
export class RecordMemberScreening {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly members: CaseMemberRepository,
  ) {}

  public async execute(input: {
    caseId: string;
    memberId: string;
    status: ScreeningStatus;
  }): Promise<{ contraindicated: boolean }> {
    const relationalCase = await this.cases.findById(input.caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(input.caseId);
    const member = await this.members.findById(input.memberId);
    if (!member || member.memberCaseId() !== input.caseId) {
      throw new CaseMemberNotFoundError(input.memberId);
    }
    member.recordScreening(input.status);
    await this.members.save(member);
    if (member.screeningContraindicatesJoint()) {
      relationalCase.contraindicate(COERCIVE_CONTRAINDICATION_REASON);
      await this.cases.save(relationalCase);
      return { contraindicated: true };
    }
    return { contraindicated: false };
  }
}
