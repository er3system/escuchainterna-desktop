import { describe, it, expect } from 'vitest';
import { RelationalCase } from '@/contexts/clinical-records/domain/RelationalCase';
import { CaseMember } from '@/contexts/clinical-records/domain/CaseMember';
import { CaseSessionNote } from '@/contexts/clinical-records/domain/CaseSessionNote';
import type { RelationalCaseRepository } from '@/contexts/clinical-records/domain/repositories/RelationalCaseRepository';
import type { CaseMemberRepository } from '@/contexts/clinical-records/domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/CaseSessionNoteRepository';
import { BuildCaseExport } from '@/contexts/clinical-records/application/relational-cases/BuildCaseExport';
import { CreateCaseMemberReport } from '@/contexts/clinical-records/application/relational-cases/CreateCaseMemberReport';
import { PatientReport } from '@/contexts/clinical-records/domain/PatientReport';
import type { PatientReportRepository } from '@/contexts/clinical-records/domain/repositories/PatientReportRepository';

class CaseRepo implements RelationalCaseRepository {
  public constructor(private readonly only: RelationalCase) {}
  public async save(): Promise<void> {}
  public async findById(id: string): Promise<RelationalCase | null> {
    return this.only.caseId() === id ? this.only : null;
  }
  public async listByOwner(): Promise<RelationalCase[]> {
    return [this.only];
  }
  public async listByPatient(): Promise<RelationalCase[]> {
    return [this.only];
  }
  public async delete(): Promise<void> {}
}

class MemberRepo implements CaseMemberRepository {
  public constructor(private readonly items: CaseMember[]) {}
  public async save(): Promise<void> {}
  public async findById(id: string): Promise<CaseMember | null> {
    return this.items.find((m) => m.memberId() === id) ?? null;
  }
  public async listByCase(caseId: string): Promise<CaseMember[]> {
    return this.items.filter((m) => m.memberCaseId() === caseId);
  }
  public async findByCaseAndPatient(): Promise<CaseMember | null> {
    return null;
  }
  public async delete(): Promise<void> {}
}

class SessionRepo implements CaseSessionNoteRepository {
  public constructor(private readonly items: CaseSessionNote[]) {}
  public async save(): Promise<void> {}
  public async findById(id: string): Promise<CaseSessionNote | null> {
    return this.items.find((s) => s.noteId() === id) ?? null;
  }
  public async listByCase(caseId: string): Promise<CaseSessionNote[]> {
    return this.items.filter((s) => s.toPrimitives().caseId === caseId);
  }
  public async delete(): Promise<void> {}
}

const A_SECRET = 'CONTENIDO-CONFIDENCIAL-DE-A-relacion-paralela';
const A_INDIVIDUAL = 'contenido individual de A';
const B_INDIVIDUAL = 'contenido individual de B';
const JOINT = 'ciclo de interaccion observado';

async function buildExport() {
  const c = RelationalCase.open({ id: 'c1', ownerUserId: 'u1', kind: 'pareja', title: 'A & B' });
  c.setSecretsPolicy('confidencialidad_limitada');
  const members = [
    CaseMember.add({ id: 'mA', caseId: 'c1', patientId: 'pac-a', ownerUserId: 'u1', label: 'A' }),
    CaseMember.add({ id: 'mB', caseId: 'c1', patientId: 'pac-b', ownerUserId: 'u1', label: 'B' }),
  ];
  const sessions = [
    CaseSessionNote.joint({ id: 's0', caseId: 'c1', ownerUserId: 'u1', title: 'Conjunta', content: JOINT }),
    CaseSessionNote.individual({ id: 's1', caseId: 'c1', ownerUserId: 'u1', memberId: 'mA', patientId: 'pac-a', title: 'A ind', content: A_INDIVIDUAL, confidential: false }),
    CaseSessionNote.individual({ id: 's2', caseId: 'c1', ownerUserId: 'u1', memberId: 'mA', patientId: 'pac-a', title: 'A secreto', content: A_SECRET, confidential: true }),
    CaseSessionNote.individual({ id: 's3', caseId: 'c1', ownerUserId: 'u1', memberId: 'mB', patientId: 'pac-b', title: 'B ind', content: B_INDIVIDUAL, confidential: false }),
  ];
  return (await new BuildCaseExport(new CaseRepo(c), new MemberRepo(members), new SessionRepo(sessions)).execute(
    'c1',
    (patientId) => (patientId === 'pac-a' ? 'Persona A' : 'Persona B'),
  ))!;
}

describe('BuildCaseExport — frontera de seguridad del export del caso (§10)', () => {
  it('el contenido confidencial NUNCA aparece en el export (requisito de seguridad)', async () => {
    const exported = await buildExport();
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain(A_SECRET);
    expect(exported.excludedConfidentialCount).toBe(1);
  });

  it('la sección de cada miembro solo trae SUS individuales no confidenciales', async () => {
    const exported = await buildExport();
    const a = exported.members.find((m) => m.patientId === 'pac-a')!;
    const b = exported.members.find((m) => m.patientId === 'pac-b')!;

    expect(a.individualSessions.map((s) => s.content)).toEqual([A_INDIVIDUAL]);
    expect(b.individualSessions.map((s) => s.content)).toEqual([B_INDIVIDUAL]);

    // El privado-individual de A NUNCA aparece en la sección de B (y viceversa).
    expect(JSON.stringify(b)).not.toContain(A_INDIVIDUAL);
    expect(JSON.stringify(b)).not.toContain(A_SECRET);
    expect(JSON.stringify(a)).not.toContain(B_INDIVIDUAL);
  });

  it('las sesiones conjuntas (compartidas) son comunes y sí se incluyen', async () => {
    const exported = await buildExport();
    expect(exported.jointSessions.map((s) => s.content)).toEqual([JOINT]);
  });
});

class ReportRepo implements PatientReportRepository {
  public readonly items: PatientReport[] = [];
  public async save(r: PatientReport): Promise<void> {
    this.items.push(r);
  }
  public async findById(id: string): Promise<PatientReport | null> {
    return this.items.find((r) => r.reportId() === id) ?? null;
  }
  public async listByPatient(): Promise<PatientReport[]> {
    return [...this.items];
  }
  public async delete(): Promise<void> {}
}

describe('CreateCaseMemberReport — el informe firmable hereda la frontera de seguridad', () => {
  async function makeReportFor(memberPatientId: string) {
    const c = RelationalCase.open({ id: 'c1', ownerUserId: 'u1', kind: 'pareja', title: 'A & B' });
    c.setSecretsPolicy('confidencialidad_limitada');
    const members = [
      CaseMember.add({ id: 'mA', caseId: 'c1', patientId: 'pac-a', ownerUserId: 'u1', label: 'A' }),
      CaseMember.add({ id: 'mB', caseId: 'c1', patientId: 'pac-b', ownerUserId: 'u1', label: 'B' }),
    ];
    const sessions = [
      CaseSessionNote.joint({ id: 's0', caseId: 'c1', ownerUserId: 'u1', title: 'Conjunta', content: JOINT }),
      CaseSessionNote.individual({ id: 's1', caseId: 'c1', ownerUserId: 'u1', memberId: 'mA', patientId: 'pac-a', title: 'A ind', content: A_INDIVIDUAL, confidential: false }),
      CaseSessionNote.individual({ id: 's2', caseId: 'c1', ownerUserId: 'u1', memberId: 'mA', patientId: 'pac-a', title: 'A secreto', content: A_SECRET, confidential: true }),
      CaseSessionNote.individual({ id: 's3', caseId: 'c1', ownerUserId: 'u1', memberId: 'mB', patientId: 'pac-b', title: 'B ind', content: B_INDIVIDUAL, confidential: false }),
    ];
    const reports = new ReportRepo();
    const id = await new CreateCaseMemberReport(new CaseRepo(c), new MemberRepo(members), new SessionRepo(sessions), reports).execute({
      caseId: 'c1',
      memberPatientId,
      resolveName: (p) => (p === 'pac-a' ? 'Persona A' : 'Persona B'),
      generatedAt: '2026-06-14T00:00:00.000Z',
    });
    return (await reports.findById(id))!.toPrimitives();
  }

  it('el informe de A trae lo compartido y SU individual, nunca lo de B ni lo confidencial', async () => {
    const report = await makeReportFor('pac-a');
    expect(report.kind).toBe('expediente');
    expect(report.patientId).toBe('pac-a');
    expect(report.content).toContain(JOINT);
    expect(report.content).toContain(A_INDIVIDUAL);
    expect(report.content).not.toContain(A_SECRET);
    expect(report.content).not.toContain(B_INDIVIDUAL);
  });
});
