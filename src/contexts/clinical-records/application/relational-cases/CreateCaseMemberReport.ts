import { randomUUID } from 'node:crypto';
import { PatientReport } from '../../domain/PatientReport';
import { buildCaseMemberReportMarkdown } from '../../domain/caseReportContent';
import {
  CaseMemberNotFoundError,
  RelationalCaseNotFoundError,
} from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '../../domain/repositories/CaseSessionNoteRepository';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';
import { BuildCaseExport, type PatientNameResolver } from './BuildCaseExport';

/**
 * Genera el informe FIRMABLE de un miembro del caso: lo guarda como un
 * patient_report kind='expediente' (estado borrador) bajo el paciente de ese
 * miembro, para que fluya por la tubería de revisión, firma y PDF existente.
 * Reusa BuildCaseExport, así que respeta la frontera de confidencialidad (§10):
 * solo lo compartido + lo individual no confidencial de ESE miembro.
 */
export class CreateCaseMemberReport {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly members: CaseMemberRepository,
    private readonly sessions: CaseSessionNoteRepository,
    private readonly reports: PatientReportRepository,
  ) {}

  public async execute(input: {
    caseId: string;
    memberPatientId: string;
    resolveName: PatientNameResolver;
    generatedAt: string;
  }): Promise<string> {
    const exported = await new BuildCaseExport(this.cases, this.members, this.sessions).execute(
      input.caseId,
      input.resolveName,
    );
    if (!exported) throw new RelationalCaseNotFoundError(input.caseId);
    const member = exported.members.find((m) => m.patientId === input.memberPatientId);
    if (!member) throw new CaseMemberNotFoundError(input.memberPatientId);

    const content = buildCaseMemberReportMarkdown({
      caseTitle: exported.title,
      memberName: member.name,
      secretsPolicy: exported.secretsPolicy,
      generatedAt: input.generatedAt,
      systemEval: exported.systemEval,
      objectives: exported.objectives,
      events: exported.events,
      relations: exported.relations,
      jointSessions: exported.jointSessions,
      individualSessions: member.individualSessions,
    });

    const report = PatientReport.draft({
      id: randomUUID(),
      patientId: input.memberPatientId,
      kind: 'expediente',
      title: `Informe del caso — ${member.name}`,
      content,
    });
    await this.reports.save(report);
    return report.reportId();
  }
}
