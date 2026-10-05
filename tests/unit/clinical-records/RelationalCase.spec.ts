import { describe, it, expect } from 'vitest';
import { RelationalCase } from '@/contexts/clinical-records/domain/RelationalCase';
import { CaseMember } from '@/contexts/clinical-records/domain/CaseMember';
import { CaseSessionNote } from '@/contexts/clinical-records/domain/CaseSessionNote';
import type { RelationalCaseRepository } from '@/contexts/clinical-records/domain/repositories/RelationalCaseRepository';
import type { CaseMemberRepository } from '@/contexts/clinical-records/domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/CaseSessionNoteRepository';
import { OpenRelationalCase } from '@/contexts/clinical-records/application/relational-cases/OpenRelationalCase';
import { AddCaseMember } from '@/contexts/clinical-records/application/relational-cases/AddCaseMember';
import { AddJointSession } from '@/contexts/clinical-records/application/relational-cases/AddJointSession';
import { EditCaseProfile } from '@/contexts/clinical-records/application/relational-cases/EditCaseProfile';
import { SetSecretsPolicy } from '@/contexts/clinical-records/application/relational-cases/SetSecretsPolicy';
import { RecordMemberScreening } from '@/contexts/clinical-records/application/relational-cases/RecordMemberScreening';
import { GrantMemberConsent } from '@/contexts/clinical-records/application/relational-cases/GrantMemberConsent';
import { UpdateCaseMember } from '@/contexts/clinical-records/application/relational-cases/UpdateCaseMember';
import {
  CaseMemberLimitReachedError,
  CaseMemberNotFoundError,
  PatientAlreadyMemberError,
} from '@/contexts/clinical-records/domain/errors/RelationalCaseErrors';

class InMemoryCaseRepo implements RelationalCaseRepository {
  public readonly cases: RelationalCase[] = [];
  public async save(c: RelationalCase): Promise<void> {
    const i = this.cases.findIndex((x) => x.caseId() === c.caseId());
    if (i >= 0) this.cases[i] = c;
    else this.cases.push(c);
  }
  public async findById(id: string): Promise<RelationalCase | null> {
    return this.cases.find((c) => c.caseId() === id) ?? null;
  }
  public async listByOwner(): Promise<RelationalCase[]> {
    return [...this.cases];
  }
  public async listByPatient(): Promise<RelationalCase[]> {
    return [...this.cases];
  }
  public async delete(id: string): Promise<void> {
    const i = this.cases.findIndex((c) => c.caseId() === id);
    if (i >= 0) this.cases.splice(i, 1);
  }
}

class InMemoryMemberRepo implements CaseMemberRepository {
  public readonly members: CaseMember[] = [];
  public async save(m: CaseMember): Promise<void> {
    const i = this.members.findIndex((x) => x.memberId() === m.memberId());
    if (i >= 0) this.members[i] = m;
    else this.members.push(m);
  }
  public async findById(id: string): Promise<CaseMember | null> {
    return this.members.find((m) => m.memberId() === id) ?? null;
  }
  public async listByCase(caseId: string): Promise<CaseMember[]> {
    return this.members.filter((m) => m.memberCaseId() === caseId);
  }
  public async findByCaseAndPatient(caseId: string, patientId: string): Promise<CaseMember | null> {
    return this.members.find((m) => m.memberCaseId() === caseId && m.memberPatientId() === patientId) ?? null;
  }
  public async delete(id: string): Promise<void> {
    const i = this.members.findIndex((m) => m.memberId() === id);
    if (i >= 0) this.members.splice(i, 1);
  }
}

class InMemorySessionRepo implements CaseSessionNoteRepository {
  public readonly notes: CaseSessionNote[] = [];
  public async save(n: CaseSessionNote): Promise<void> {
    const i = this.notes.findIndex((x) => x.noteId() === n.noteId());
    if (i >= 0) this.notes[i] = n;
    else this.notes.push(n);
  }
  public async findById(id: string): Promise<CaseSessionNote | null> {
    return this.notes.find((n) => n.noteId() === id) ?? null;
  }
  public async listByCase(caseId: string): Promise<CaseSessionNote[]> {
    return this.notes.filter((n) => n.toPrimitives().caseId === caseId);
  }
  public async delete(id: string): Promise<void> {
    const i = this.notes.findIndex((n) => n.noteId() === id);
    if (i >= 0) this.notes.splice(i, 1);
  }
}

describe('Caso relacional (vínculos pareja/familia §10)', () => {
  it('abre un caso activo sin política de secretos definida', async () => {
    const cases = new InMemoryCaseRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'Pareja A & B' });
    const c = (await cases.findById(id))!;
    expect(c.isActive()).toBe(true);
    expect(c.hasSecretsPolicy()).toBe(false);
    expect(c.belongsToOwner('u1')).toBe(true);
  });

  it('NO se puede iniciar sesión individual sin política de secretos (decidirla antes)', async () => {
    const cases = new InMemoryCaseRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    expect((await cases.findById(id))!.canStartIndividualSession()).toBe(false);
    await new SetSecretsPolicy(cases).execute(id, 'confidencialidad_limitada');
    expect((await cases.findById(id))!.canStartIndividualSession()).toBe(true);
    expect((await cases.findById(id))!.hasSecretsPolicy()).toBe(true);
  });

  it('la política de secretos solo admite los dos valores defendibles', () => {
    const c = RelationalCase.open({ id: 'c1', ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    expect(() => c.setSecretsPolicy('' as never)).toThrow();
    expect(() => c.setSecretsPolicy('inventado' as never)).toThrow();
    c.setSecretsPolicy('no_secretos');
    expect(c.toPrimitives().secretsPolicy).toBe('no_secretos');
  });

  it('una pareja admite exactamente dos miembros y no duplica un paciente', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    const add = new AddCaseMember(cases, members);
    await add.execute({ caseId: id, patientId: 'pac-a', label: 'Miembro A' });
    await add.execute({ caseId: id, patientId: 'pac-b', label: 'Miembro B' });
    expect(await members.listByCase(id)).toHaveLength(2);
    // Tercer miembro en pareja → error.
    await expect(add.execute({ caseId: id, patientId: 'pac-c', label: 'C' })).rejects.toThrow(CaseMemberLimitReachedError);
    // Paciente duplicado → error.
    await expect(add.execute({ caseId: id, patientId: 'pac-a', label: 'A otra vez' })).rejects.toThrow(PatientAlreadyMemberError);
  });

  it('el cribado con violencia coercitiva CONTRAINDICA el caso; sin hallazgos no', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    const memberId = await new AddCaseMember(cases, members).execute({ caseId: id, patientId: 'pac-a', label: 'A' });
    const screening = new RecordMemberScreening(cases, members);

    const r1 = await screening.execute({ caseId: id, memberId, status: 'sin_hallazgos' });
    expect(r1.contraindicated).toBe(false);
    expect((await cases.findById(id))!.isContraindicated()).toBe(false);

    const r2 = await screening.execute({ caseId: id, memberId, status: 'violencia_coercitiva' });
    expect(r2.contraindicated).toBe(true);
    expect((await cases.findById(id))!.isContraindicated()).toBe(true);
    expect((await cases.findById(id))!.toPrimitives().contraindicationReason).toContain('coercitivo');
  });

  it('la violencia situacional NO contraindica automáticamente (juicio clínico)', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    const memberId = await new AddCaseMember(cases, members).execute({ caseId: id, patientId: 'pac-a', label: 'A' });
    const r = await new RecordMemberScreening(cases, members).execute({ caseId: id, memberId, status: 'violencia_situacional' });
    expect(r.contraindicated).toBe(false);
    expect((await cases.findById(id))!.isActive()).toBe(true);
  });

  it('un caso de FAMILIA admite 3 o más miembros (sin tope de pareja)', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'Familia X' });
    const add = new AddCaseMember(cases, members);
    await add.execute({ caseId: id, patientId: 'pac-a', label: 'Madre', role: 'Madre' });
    await add.execute({ caseId: id, patientId: 'pac-b', label: 'Padre', role: 'Padre' });
    await add.execute({ caseId: id, patientId: 'pac-c', label: 'Hijo', role: 'Hijo/a' });
    expect(await members.listByCase(id)).toHaveLength(3);
    // El rol se guarda en cada miembro.
    expect((await members.listByCase(id)).map((m) => m.toPrimitives().role).sort()).toEqual(['Hijo/a', 'Madre', 'Padre']);
  });

  it('UpdateCaseMember fija rol y paciente identificado; valida el binding caso↔miembro', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'F' });
    const memberId = await new AddCaseMember(cases, members).execute({ caseId: id, patientId: 'pac-a', label: 'A' });
    const update = new UpdateCaseMember(members);

    await update.execute({ caseId: id, memberId, role: 'Hijo/a', isIdentifiedPatient: true });
    const saved = (await members.findById(memberId))!.toPrimitives();
    expect(saved.role).toBe('Hijo/a');
    expect(saved.isIdentifiedPatient).toBe(true);

    // Quitar paciente identificado sin tocar el rol (campo omitido).
    await update.execute({ caseId: id, memberId, isIdentifiedPatient: false });
    const after = (await members.findById(memberId))!.toPrimitives();
    expect(after.isIdentifiedPatient).toBe(false);
    expect(after.role).toBe('Hijo/a');

    // Caso ajeno al miembro → rechazado (scoping).
    await expect(update.execute({ caseId: 'otro-caso', memberId, role: 'X' })).rejects.toThrow(CaseMemberNotFoundError);
  });

  it('AddJointSession registra los ASISTENTES (subsistema); conserva en round-trip', async () => {
    const cases = new InMemoryCaseRepo();
    const sessions = new InMemorySessionRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'F' });
    const noteId = await new AddJointSession(cases, sessions).execute({
      caseId: id,
      title: 'Sesión solo con los padres',
      content: 'Subsistema parental',
      attendees: ['m-madre', 'm-padre', 'm-padre'], // dedup
    });
    const note = (await sessions.findById(noteId))!;
    expect(note.isJoint()).toBe(true);
    expect(note.attendeeMemberIds().sort()).toEqual(['m-madre', 'm-padre']);
    // Round-trip por primitives conserva asistentes.
    const restored = CaseSessionNote.fromPrimitives(note.toPrimitives());
    expect(restored.attendeeMemberIds().sort()).toEqual(['m-madre', 'm-padre']);
  });

  it('una sesión individual no lleva asistentes', () => {
    const note = CaseSessionNote.individual({
      id: 's1', caseId: 'c1', ownerUserId: 'u1', memberId: 'm1', patientId: 'p1', title: 'X', content: 'y', confidential: false,
    });
    expect(note.attendeeMemberIds()).toEqual([]);
  });

  it('CaseMember round-trip conserva rol y paciente identificado', () => {
    const m = CaseMember.add({ id: 'm1', caseId: 'c1', patientId: 'p1', ownerUserId: 'u1', label: 'A', role: 'Madre' });
    m.setIdentifiedPatient(true);
    const restored = CaseMember.fromPrimitives(m.toPrimitives());
    expect(restored.toPrimitives().role).toBe('Madre');
    expect(restored.toPrimitives().isIdentifiedPatient).toBe(true);
  });

  it('EditCaseProfile guarda evaluación del sistema y objetivos', async () => {
    const cases = new InMemoryCaseRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'F' });
    const edit = new EditCaseProfile(cases);
    await edit.setSystemEval(id, {
      lifeCycleStage: 'Hijos adolescentes',
      structure: 'Coalición madre-hijo',
      communication: 'Escaladas simétricas',
      systemMotive: 'Conflictos por límites',
    });
    await edit.setObjectives(id, 'Recuperar la jerarquía parental');
    const p = (await cases.findById(id))!.toPrimitives().profile;
    expect(p.systemEval.structure).toBe('Coalición madre-hijo');
    expect(p.objectives).toBe('Recuperar la jerarquía parental');
  });

  it('línea de tiempo: añade y quita eventos', async () => {
    const cases = new InMemoryCaseRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'F' });
    const edit = new EditCaseProfile(cases);
    await edit.addEvent(id, { date: '2019', title: 'Separación', note: '' });
    await edit.addEvent(id, { date: '2021', title: 'Nacimiento', note: 'segundo hijo' });
    let events = (await cases.findById(id))!.toPrimitives().profile.events;
    expect(events).toHaveLength(2);
    await edit.removeEvent(id, events[0].id);
    events = (await cases.findById(id))!.toPrimitives().profile.events;
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Nacimiento');
  });

  it('mapa de relaciones: upsert por PAR (no duplica A-B / B-A) y se puede quitar', async () => {
    const cases = new InMemoryCaseRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'familia', title: 'F' });
    const edit = new EditCaseProfile(cases);
    await edit.upsertRelation(id, { aMemberId: 'm1', bMemberId: 'm2', quality: 'conflictivo', note: 'roces' });
    // Mismo par en orden inverso → ACTUALIZA, no duplica.
    await edit.upsertRelation(id, { aMemberId: 'm2', bMemberId: 'm1', quality: 'distante', note: 'frío' });
    let relations = (await cases.findById(id))!.toPrimitives().profile.relations;
    expect(relations).toHaveLength(1);
    expect(relations[0].quality).toBe('distante');
    // Otro par distinto → se añade.
    await edit.upsertRelation(id, { aMemberId: 'm1', bMemberId: 'm3', quality: 'cercano', note: '' });
    relations = (await cases.findById(id))!.toPrimitives().profile.relations;
    expect(relations).toHaveLength(2);
    // No admite relación de un miembro consigo mismo.
    await expect(edit.upsertRelation(id, { aMemberId: 'm1', bMemberId: 'm1', quality: 'cercano', note: '' })).rejects.toThrow();
    // Quitar.
    await edit.removeRelation(id, relations[0].id);
    expect((await cases.findById(id))!.toPrimitives().profile.relations).toHaveLength(1);
  });

  it('consentimiento doble: cada miembro otorga el suyo por separado', async () => {
    const cases = new InMemoryCaseRepo();
    const members = new InMemoryMemberRepo();
    const id = await new OpenRelationalCase(cases).execute({ ownerUserId: 'u1', kind: 'pareja', title: 'P' });
    const add = new AddCaseMember(cases, members);
    const a = await add.execute({ caseId: id, patientId: 'pac-a', label: 'A' });
    const b = await add.execute({ caseId: id, patientId: 'pac-b', label: 'B' });
    const grant = new GrantMemberConsent(members);
    // Binding caseId↔memberId: otorgar con un caso ajeno al miembro se rechaza.
    await expect(grant.execute('caso-ajeno', a)).rejects.toThrow();
    await grant.execute(id, a);
    expect((await members.listByCase(id)).every((m) => m.hasConsent())).toBe(false);
    await grant.execute(id, b);
    expect((await members.listByCase(id)).every((m) => m.hasConsent())).toBe(true);
  });
});
