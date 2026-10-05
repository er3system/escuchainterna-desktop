import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '../../domain/repositories/CaseSessionNoteRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

export interface CaseExportSessionEntry {
  title: string;
  content: string;
  createdAt: string;
}

export interface CaseExportMemberSection {
  patientId: string;
  name: string;
  consentStatus: string;
  screeningStatus: string;
  /** SOLO las sesiones individuales NO confidenciales de ESTE miembro. */
  individualSessions: CaseExportSessionEntry[];
}

export interface CaseExportRelation {
  a: string;
  b: string;
  quality: string;
  note: string;
}

export interface CaseExport {
  caseId: string;
  title: string;
  kind: string;
  status: string;
  secretsPolicy: string;
  /** Sesiones conjuntas (compartidas con todo el caso). */
  jointSessions: CaseExportSessionEntry[];
  members: CaseExportMemberSection[];
  /** Perfil del sistema (evaluación, objetivos, eventos, relaciones con nombres resueltos). */
  systemEval: { lifeCycleStage: string; structure: string; communication: string; systemMotive: string };
  objectives: string;
  events: { date: string; title: string; note: string }[];
  relations: CaseExportRelation[];
  /** Nº de sesiones confidenciales excluidas del export (sin su contenido). */
  excludedConfidentialCount: number;
}

/** Resuelve el nombre de un paciente; el repo concreto se inyecta como función. */
export type PatientNameResolver = (patientId: string) => string;

/**
 * Ensambla el export del caso garantizando la frontera de seguridad (§10): el
 * contenido 'confidential' NUNCA se incluye, y la sección de cada miembro SOLO
 * contiene sus propias sesiones individuales no confidenciales (jamás las del
 * otro miembro). Las conjuntas (compartidas) son comunes. Requisito de seguridad,
 * no preferencia.
 */
export class BuildCaseExport {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly members: CaseMemberRepository,
    private readonly sessions: CaseSessionNoteRepository,
  ) {}

  public async execute(caseId: string, resolveName: PatientNameResolver): Promise<CaseExport | null> {
    const relationalCase = await this.cases.findById(caseId);
    if (!relationalCase) return null;
    const c = relationalCase.toPrimitives();
    const allSessions = await this.sessions.listByCase(caseId);

    // Lo confidencial se EXCLUYE por completo (no se filtra a ningún export).
    const exportable = allSessions.filter((session) => session.includedInCaseExport());
    const excludedConfidentialCount = allSessions.length - exportable.length;

    const jointSessions = exportable
      .filter((session) => session.isJoint())
      .map((session) => this.toEntry(session.toPrimitives()));

    const caseMembers = await this.members.listByCase(caseId);
    const members: CaseExportMemberSection[] = caseMembers.map((member) => {
      const m = member.toPrimitives();
      const individualSessions = exportable
        .filter((session) => !session.isJoint() && session.ownerPatientId() === m.patientId)
        .map((session) => this.toEntry(session.toPrimitives()));
      return {
        patientId: m.patientId,
        name: resolveName(m.patientId),
        consentStatus: m.consentStatus,
        screeningStatus: m.screeningStatus,
        individualSessions,
      };
    });

    // Perfil del sistema: resuelve los ids de miembro de las relaciones a nombres.
    const nameByMember = new Map(
      caseMembers.map((member) => [member.memberId(), resolveName(member.memberPatientId())]),
    );
    const relations: CaseExportRelation[] = c.profile.relations.map((rel) => ({
      a: nameByMember.get(rel.aMemberId) ?? 'Miembro',
      b: nameByMember.get(rel.bMemberId) ?? 'Miembro',
      quality: rel.quality,
      note: rel.note,
    }));

    return {
      caseId,
      title: c.title,
      kind: c.kind,
      status: c.status,
      secretsPolicy: c.secretsPolicy,
      jointSessions,
      members,
      systemEval: c.profile.systemEval,
      objectives: c.profile.objectives,
      events: [...c.profile.events]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ date: e.date, title: e.title, note: e.note })),
      relations,
      excludedConfidentialCount,
    };
  }

  private toEntry(primitives: { title: string; content: string; createdAt: string }): CaseExportSessionEntry {
    return { title: primitives.title, content: primitives.content, createdAt: primitives.createdAt };
  }
}
