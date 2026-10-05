import { CaseMemberNotFoundError } from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';

/** Marca otorgado el consentimiento de un miembro (consentimiento doble del caso). */
export class GrantMemberConsent {
  public constructor(private readonly members: CaseMemberRepository) {}

  public async execute(caseId: string, memberId: string): Promise<void> {
    const member = await this.members.findById(memberId);
    // El miembro debe pertenecer al caso recibido (binding caseId↔memberId), igual
    // que RecordMemberScreening/AddIndividualSession: evita otorgar el consentimiento
    // de un miembro asociándolo a un caso que no le corresponde.
    if (!member || member.memberCaseId() !== caseId) throw new CaseMemberNotFoundError(memberId);
    member.grantConsent();
    await this.members.save(member);
  }
}
