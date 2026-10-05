import { describe, it, expect } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { ClinicalTemplate } from '@/contexts/clinical-records/domain/ClinicalTemplate';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalTemplateRepository';
import {
  historiaBlockCatalog,
  historiaNucleoSections,
} from '@/contexts/clinical-records/domain/historiaBlocks';
import { BUILTIN_CLINICAL_TEMPLATES } from '@/shared/infrastructure/persistence/builtinTemplates';
import { EnsurePrimaryHistory } from '@/contexts/clinical-records/application/historia-clinica/EnsurePrimaryHistory';
import { AddHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/AddHistoriaBlock';
import { RemoveHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/RemoveHistoriaBlock';

/** Repo de plantillas en memoria respaldado por las plantillas integradas. */
class BuiltinTemplateRepository implements ClinicalTemplateRepository {
  public async save(): Promise<void> {}
  public async delete(): Promise<void> {}
  public async listAll(): Promise<ClinicalTemplate[]> {
    return BUILTIN_CLINICAL_TEMPLATES.map((t) =>
      ClinicalTemplate.fromPrimitives({ ...t, isBuiltin: true, createdAt: '2026-01-01T00:00:00.000Z' }),
    );
  }
  public async findById(id: string): Promise<ClinicalTemplate | null> {
    return (await this.listAll()).find((t) => t.templateId() === id) ?? null;
  }
}

function ownSectionCount(templateId: string): number {
  const template = BUILTIN_CLINICAL_TEMPLATES.find((t) => t.id === templateId)!;
  return template.sections.filter((s) => s.id !== 'notas-adicionales').length;
}

class InMemoryClinicalRecordRepository implements ClinicalRecordRepository {
  public readonly records: ClinicalRecord[] = [];

  public async save(record: ClinicalRecord): Promise<void> {
    const index = this.records.findIndex((r) => r.recordId() === record.recordId());
    if (index >= 0) this.records[index] = record;
    else this.records.push(record);
  }

  public async findById(id: string): Promise<ClinicalRecord | null> {
    return this.records.find((r) => r.recordId() === id) ?? null;
  }

  public async listByPatient(patientId: string): Promise<ClinicalRecord[]> {
    return this.records.filter((r) => r.belongsTo(patientId));
  }

  public async findPrimaryHistory(patientId: string): Promise<ClinicalRecord | null> {
    return this.records.find((r) => r.belongsTo(patientId) && r.isPrimaryHistory()) ?? null;
  }

  public async delete(id: string): Promise<void> {
    const index = this.records.findIndex((r) => r.recordId() === id);
    if (index >= 0) this.records.splice(index, 1);
  }
}

describe('Historia clínica consolidada', () => {
  it('EnsurePrimaryHistory crea la historia con el núcleo y es idempotente', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const ensure = new EnsurePrimaryHistory(repo);

    const id1 = await ensure.ensure('paciente-1');
    expect(repo.records).toHaveLength(1);
    const historia = (await repo.findById(id1))!;
    expect(historia.isPrimaryHistory()).toBe(true);
    expect(historia.ownSections()?.length).toBe(historiaNucleoSections().length);

    // Segunda llamada: no crea otra, devuelve la misma.
    const id2 = await ensure.ensure('paciente-1');
    expect(id2).toBe(id1);
    expect(repo.records).toHaveLength(1);
  });

  it('EnsurePrimaryHistory con force crea OTRA primaria (nuevo episodio que coexiste)', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const ensure = new EnsurePrimaryHistory(repo);

    const id1 = await ensure.ensure('paciente-1');
    // force=true: abre otra primaria aunque ya haya una (los episodios coexisten).
    const id2 = await ensure.ensure('paciente-1', null, true);
    expect(id2).not.toBe(id1);
    expect(repo.records).toHaveLength(2);
  });

  it('AddHistoriaBlock anexa una sección con ids namespaced y no duplica', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
    const baseCount = (await repo.findById(id))!.ownSections()!.length;

    const block = historiaBlockCatalog().find((b) => b.category === 'Técnica')!;
    const add = new AddHistoriaBlock(repo);
    await add.add(id, 'paciente-1', block.id);

    const sections = (await repo.findById(id))!.ownSections()!;
    expect(sections).toHaveLength(baseCount + 1);
    const added = sections[sections.length - 1];
    expect(added.id).toBe(block.id); // id de sección = id del bloque (único)
    expect(added.fields.every((f) => f.id.startsWith(`${block.id}::`))).toBe(true);

    // Añadir el mismo bloque otra vez no duplica.
    await add.add(id, 'paciente-1', block.id);
    expect((await repo.findById(id))!.ownSections()!).toHaveLength(baseCount + 1);
  });

  it('AddHistoriaBlock con bloque desconocido es no-op', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
    const before = (await repo.findById(id))!.ownSections()!.length;
    await new AddHistoriaBlock(repo).add(id, 'paciente-1', 'bloque-inexistente:x');
    expect((await repo.findById(id))!.ownSections()!).toHaveLength(before);
  });

  it('RemoveHistoriaBlock quita un bloque añadido y vuelve al núcleo', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
    const baseCount = (await repo.findById(id))!.ownSections()!.length;
    const block = historiaBlockCatalog().find((b) => b.category === 'Técnica')!;
    await new AddHistoriaBlock(repo).add(id, 'paciente-1', block.id);
    expect((await repo.findById(id))!.ownSections()!).toHaveLength(baseCount + 1);

    await new RemoveHistoriaBlock(repo).remove(id, 'paciente-1', block.id);
    expect((await repo.findById(id))!.ownSections()!).toHaveLength(baseCount);
  });

  it('RemoveHistoriaBlock PODA las respuestas del bloque (no quedan huérfanas ni reaparecen)', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
    const block = historiaBlockCatalog().find((b) => b.category === 'Técnica')!;
    await new AddHistoriaBlock(repo).add(id, 'paciente-1', block.id);
    const fieldId = (await repo.findById(id))!.ownSections()!.find((s) => s.id === block.id)!.fields[0].id;

    const record = (await repo.findById(id))!;
    record.answerField(fieldId, 'dato clínico del bloque');
    await repo.save(record);
    expect((await repo.findById(id))!.toPrimitives().answers[fieldId]).toBe('dato clínico del bloque');

    await new RemoveHistoriaBlock(repo).remove(id, 'paciente-1', block.id);
    const after = (await repo.findById(id))!.toPrimitives().answers;
    expect(after[fieldId]).toBeUndefined();
    expect(Object.keys(after).some((k) => k.startsWith(`${block.id}::`))).toBe(false);
  });

  it('RemoveHistoriaBlock NO puede quitar una sección del núcleo (id sin namespace)', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
    const nucleoSectionId = (await repo.findById(id))!.ownSections()![0].id; // id simple, sin ':'

    await new RemoveHistoriaBlock(repo).remove(id, 'paciente-1', nucleoSectionId);
    expect((await repo.findById(id))!.ownSections()!.some((s) => s.id === nucleoSectionId)).toBe(true);
  });

  it('un registro normal (no historia) no expone secciones propias', () => {
    const record = ClinicalRecord.start({
      id: 'r1',
      patientId: 'p1',
      templateId: 'builtin-historia-general',
      title: 'Registro',
    });
    expect(record.isPrimaryHistory()).toBe(false);
    expect(record.ownSections()).toBeNull();
  });

  it('iniciar con un modelo nuevo compone general + núcleo específico del modelo (§1/§3)', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const templates = new BuiltinTemplateRepository();
    const id = await new EnsurePrimaryHistory(repo, templates).ensure('p-trec', 'builtin-trec');
    const sections = (await repo.findById(id))!.ownSections()!;
    expect(sections).toHaveLength(historiaNucleoSections().length + ownSectionCount('builtin-trec'));
    // El núcleo general va primero (admisión transversal), luego el del modelo.
    expect(sections[0].id).toBe(historiaNucleoSections()[0].id);
    expect(sections.some((s) => s.id === 'acontecimiento-activador')).toBe(true);
  });

  it('iniciar con un modelo legacy autocontenido usa solo sus secciones (sin componer)', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const templates = new BuiltinTemplateRepository();
    const id = await new EnsurePrimaryHistory(repo, templates).ensure('p-tcc', 'builtin-tcc');
    expect((await repo.findById(id))!.ownSections()).toHaveLength(ownSectionCount('builtin-tcc'));
  });

  it('iniciar sin modelo (o sin repo de plantillas) usa el núcleo general', async () => {
    const repo = new InMemoryClinicalRecordRepository();
    const id = await new EnsurePrimaryHistory(repo, new BuiltinTemplateRepository()).ensure('p-gen', null);
    expect((await repo.findById(id))!.ownSections()).toHaveLength(historiaNucleoSections().length);
  });
});
