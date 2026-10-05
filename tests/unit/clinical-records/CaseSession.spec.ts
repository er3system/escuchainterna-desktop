import { describe, it, expect } from 'vitest';
import { RelationalCase } from '@/contexts/clinical-records/domain/RelationalCase';
import { CaseMember } from '@/contexts/clinical-records/domain/CaseMember';
import { CaseSessionNote } from '@/contexts/clinical-records/domain/CaseSessionNote';
import type { RelationalCaseRepository } from '@/contexts/clinical-records/domain/repositories/RelationalCaseRepository';
import type { CaseMemberRepository } from '@/contexts/clinical-records/domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/CaseSessionNoteRepository';
import { AddJointSession } from '@/contexts/clinical-records/application/relational-cases/AddJointSession';
import { AddIndividualSession } from '@/contexts/clinical-records/application/relational-cases/AddIndividualSession';
import {
  CaseContraindicatedError,
  SecretsPolicyRequiredError,
} from '@/contexts/clinical-records/domain/errors/RelationalCaseErrors';

class CaseRepo implements RelationalCaseRepository {
  public readonly items: RelationalCase[] = [];
  public async save(c: RelationalCase): Promise<void> {
    const i = this.items.findIndex((x) => x.caseId() === c.caseId());
    if (i >= 0) this.items[i] = c;
    else this.items.push(c);
  }
  public async findById(id: string): Promise<RelationalCase | null> {
    return this.items.find((c) => c.caseId() === id) ?? null;
  }
  public async listByOwner(): Promise<RelationalCase[]> {
    return [...this.items];
  }
  public async listByPatient(): Promise<RelationalCase[]> {
    return [...this.items];
  }
  public async delete(): Promise<void> {}
}

class MemberRepo implements CaseMemberRepository {
  public readonly items: CaseMember[] = [];
  public async save(m: CaseMember): Promise<void> {
    this.items.push(m);
  }
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
  public readonly items: CaseSessionNote[] = [];
  public async save(n: CaseSessionNote): Promise<void> {
    this.items.push(n);
  }
  public async findById(id: string): Promise<CaseSessionNote | null> {
    return this.items.find((n) => n.noteId() === id) ?? null;
  }
  public async listByCase(caseId: string): Promise<CaseSessionNote[]> {
    return this.items.filter(() => caseId);
  }
  public async delete(): Promise<void> {}
}

async function activeCaseWithPolicy(): Promise<{ cases: CaseRepo; members: MemberRepo; caseId: string; memberId: string }> {
  const cases = new CaseRepo();
  const members = new MemberRepo();
  const c = RelationalCase.open({ id: 'c1', ownerUserId: 'u1', kind: 'pareja', title: 'P' });
  await cases.save(c);
  const m = CaseMember.add({ id: 'm1', caseId: 'c1', patientId: 'pac-a', ownerUserId: 'u1', label: 'A' });
  await members.save(m);
  return { cases, members, caseId: 'c1', memberId: 'm1' };
}

describe('Sesiones del caso — 3 círculos de visibilidad y gates (§10)', () => {
  it('NO se puede iniciar sesión individual sin política de secretos acordada', async () => {
    const { cases, members, caseId, memberId } = await activeCaseWithPolicy();
    const sessions = new SessionRepo();
    const add = new AddIndividualSession(cases, members, sessions);
    await expect(add.execute({ caseId, memberId, title: 'Ind', content: 'x', confidential: false })).rejects.toThrow(
      SecretsPolicyRequiredError,
    );
    // Tras acordar la política, sí.
    (await cases.findById(caseId))!.setSecretsPolicy('confidencialidad_limitada');
    const id = await add.execute({ caseId, memberId, title: 'Ind', content: 'x', confidential: false });
    expect((await sessions.findById(id))!.visibility()).toBe('individual');
  });

  it('una sesión individual confidencial NUNCA entra en el export del caso', async () => {
    const { cases, members, caseId, memberId } = await activeCaseWithPolicy();
    (await cases.findById(caseId))!.setSecretsPolicy('no_secretos');
    const sessions = new SessionRepo();
    const add = new AddIndividualSession(cases, members, sessions);
    const id = await add.execute({ caseId, memberId, title: 'Secreto', content: 'relación paralela', confidential: true });
    const note = (await sessions.findById(id))!;
    expect(note.isConfidential()).toBe(true);
    expect(note.includedInCaseExport()).toBe(false);
    // No visible para la otra persona (otro patientId).
    expect(note.isVisibleToMemberPatient('pac-b')).toBe(false);
    expect(note.isVisibleToMemberPatient('pac-a')).toBe(true);
  });

  it('una sesión conjunta es compartida (visible a todo el caso) y entra al export', async () => {
    const { cases, caseId } = await activeCaseWithPolicy();
    const sessions = new SessionRepo();
    const id = await new AddJointSession(cases, sessions).execute({ caseId, title: 'Conjunta 1', content: 'ciclo' });
    const note = (await sessions.findById(id))!;
    expect(note.isJoint()).toBe(true);
    expect(note.includedInCaseExport()).toBe(true);
    expect(note.isVisibleToMemberPatient('pac-a')).toBe(true);
    expect(note.isVisibleToMemberPatient('pac-b')).toBe(true);
  });

  it('un caso contraindicado no admite nuevas sesiones (conjuntas ni individuales)', async () => {
    const { cases, members, caseId, memberId } = await activeCaseWithPolicy();
    (await cases.findById(caseId))!.setSecretsPolicy('no_secretos');
    (await cases.findById(caseId))!.contraindicate('control coercitivo');
    const sessions = new SessionRepo();
    await expect(new AddJointSession(cases, sessions).execute({ caseId, title: 'x', content: 'y' })).rejects.toThrow(
      CaseContraindicatedError,
    );
    await expect(
      new AddIndividualSession(cases, members, sessions).execute({ caseId, memberId, title: 'x', content: 'y', confidential: false }),
    ).rejects.toThrow(CaseContraindicatedError);
  });
});
