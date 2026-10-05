import { describe, it, expect } from 'vitest';
import { Diagnosis, parseDiagnosisStatus } from '@/contexts/clinical-records/domain/Diagnosis';
import type { DiagnosisRepository } from '@/contexts/clinical-records/domain/repositories/DiagnosisRepository';
import type { Cie11Catalog, Cie11Entry } from '@/contexts/clinical-records/domain/repositories/Cie11Catalog';
import { RegisterDiagnosis } from '@/contexts/clinical-records/application/register-diagnosis/RegisterDiagnosis';
import { RegisterDiagnosisMessage } from '@/contexts/clinical-records/application/register-diagnosis/RegisterDiagnosisMessage';
import { UpdateDiagnosisStatus } from '@/contexts/clinical-records/application/update-diagnosis-status/UpdateDiagnosisStatus';
import { SetDiagnosisFormality } from '@/contexts/clinical-records/application/set-diagnosis-formality/SetDiagnosisFormality';
import { ListDiagnoses } from '@/contexts/clinical-records/application/list-diagnoses/ListDiagnoses';
import type {
  ProfessionalIdentity,
  ProfessionalIdentityReader,
} from '@/contexts/clinical-records/domain/repositories/ProfessionalIdentityReader';
import { InvalidDiagnosisStatusError } from '@/contexts/clinical-records/domain/errors/InvalidDiagnosisStatusError';
import { DiagnosisNotFoundError } from '@/contexts/clinical-records/domain/errors/DiagnosisNotFoundError';
import { ProfessionalLicenseRequiredError } from '@/contexts/clinical-records/domain/errors/ProfessionalLicenseRequiredError';

function identityReader(license: string): ProfessionalIdentityReader {
  const identity: ProfessionalIdentity = {
    fullName: 'Dra. Pérez',
    professionalLicense: license,
    email: 'p@e.test',
    contactPhone: '',
    contactAddress: '',
    organizationName: null,
    organizationLogoDataUri: null,
  };
  return { read: () => Promise.resolve(identity) };
}

class InMemoryDiagnoses implements DiagnosisRepository {
  public readonly items: Diagnosis[] = [];
  public async save(diagnosis: Diagnosis): Promise<void> {
    const i = this.items.findIndex((d) => d.diagnosisId() === diagnosis.diagnosisId());
    if (i >= 0) this.items[i] = diagnosis;
    else this.items.push(diagnosis);
  }
  public async findById(id: string): Promise<Diagnosis | null> {
    return this.items.find((d) => d.diagnosisId() === id) ?? null;
  }
  public async listByPatient(patientId: string): Promise<Diagnosis[]> {
    return this.items.filter((d) => d.belongsTo(patientId));
  }
  public async delete(id: string): Promise<void> {
    const i = this.items.findIndex((d) => d.diagnosisId() === id);
    if (i >= 0) this.items.splice(i, 1);
  }
}

class InMemoryCie11Catalog implements Cie11Catalog {
  private readonly byCode = new Map<string, Cie11Entry>();
  public constructor(entries: Cie11Entry[]) {
    for (const e of entries) this.byCode.set(e.code, e);
  }
  public async searchByText(text: string, limit: number): Promise<Cie11Entry[]> {
    const q = text.toLowerCase();
    return [...this.byCode.values()].filter((e) => e.title.toLowerCase().includes(q)).slice(0, limit);
  }
  public async childrenOf(parentCode: string | null, _chapter: string): Promise<Cie11Entry[]> {
    return [...this.byCode.values()].filter((e) => e.parent === parentCode);
  }
  public async ancestorsOf(_code: string): Promise<Cie11Entry[]> {
    return [];
  }
  public async findByCode(code: string): Promise<Cie11Entry | null> {
    return this.byCode.get(code) ?? null;
  }
  public async totalEntries(): Promise<number> {
    return this.byCode.size;
  }
}

const CATALOG_ENTRY: Cie11Entry = {
  code: '6B00',
  title: 'Trastorno de ansiedad generalizada',
  parent: null,
  level: 1,
  chapter: '06',
};

function catalogWithEntry(): InMemoryCie11Catalog {
  return new InMemoryCie11Catalog([CATALOG_ENTRY]);
}

describe('parseDiagnosisStatus (value-object de estado)', () => {
  it('acepta los tres estados válidos', () => {
    expect(parseDiagnosisStatus('activo')).toBe('activo');
    expect(parseDiagnosisStatus('descartado')).toBe('descartado');
    expect(parseDiagnosisStatus('remitido')).toBe('remitido');
  });

  it('rechaza un valor inválido con InvalidDiagnosisStatusError', () => {
    expect(() => parseDiagnosisStatus('inventado')).toThrow(InvalidDiagnosisStatusError);
    expect(() => parseDiagnosisStatus('')).toThrow(InvalidDiagnosisStatusError);
  });
});

describe('Diagnosis (dominio)', () => {
  it('nace en estado activo y conoce a su paciente', () => {
    const dx = Diagnosis.register({
      id: 'dx-1',
      patientId: 'pac-1',
      cie11Code: '6B00',
      cie11Title: 'Trastorno de ansiedad generalizada',
      notes: 'Cuadro de un año',
    });
    expect(dx.toPrimitives().status).toBe('activo');
    expect(dx.belongsTo('pac-1')).toBe(true);
    expect(dx.belongsTo('otro')).toBe(false);
    expect(dx.diagnosisId()).toBe('dx-1');
  });

  it('changeStatus y updateNotes mutan el estado y las notas', () => {
    const dx = Diagnosis.register({
      id: 'dx-1',
      patientId: 'pac-1',
      cie11Code: '6B00',
      cie11Title: 'Trastorno de ansiedad generalizada',
      notes: 'inicial',
    });
    dx.changeStatus('remitido');
    dx.updateNotes('en remisión tras 12 sesiones');
    const p = dx.toPrimitives();
    expect(p.status).toBe('remitido');
    expect(p.notes).toBe('en remisión tras 12 sesiones');
  });

  it('nace como HIPÓTESIS y solo confirmarlo como formal cambia la naturaleza', () => {
    const dx = Diagnosis.register({
      id: 'dx-1',
      patientId: 'pac-1',
      cie11Code: '6B00',
      cie11Title: 'TAG',
      notes: '',
      registeredByUserId: 'practicante-1',
    });
    expect(dx.toPrimitives().kind).toBe('hipotesis');
    expect(dx.isFormal()).toBe(false);
    expect(dx.toPrimitives().diagnosedByUserId).toBe('practicante-1');

    dx.confirmAsFormal({ confirmedByUserId: 'profesional-9' });
    expect(dx.isFormal()).toBe(true);
    expect(dx.toPrimitives().kind).toBe('formal');
    expect(dx.toPrimitives().diagnosedByUserId).toBe('profesional-9');

    dx.revertToHypothesis();
    expect(dx.toPrimitives().kind).toBe('hipotesis');
  });

  it('round-trip toPrimitives/fromPrimitives conserva todos los campos', () => {
    const original = Diagnosis.register({
      id: 'dx-1',
      patientId: 'pac-1',
      cie11Code: '6B00',
      cie11Title: 'Trastorno de ansiedad generalizada',
      notes: 'nota',
    });
    original.changeStatus('descartado');
    const primitives = original.toPrimitives();
    const restored = Diagnosis.fromPrimitives(primitives);
    expect(restored.toPrimitives()).toEqual(primitives);
  });
});

describe('RegisterDiagnosis (caso de uso)', () => {
  it('registra contra el catálogo y copia code/title del catálogo, no del input', async () => {
    const repo = new InMemoryDiagnoses();
    // El mensaje sólo lleva el código; el título no se aporta desde fuera.
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: 'algo' }),
    );
    const saved = (await repo.findById(id))!.toPrimitives();
    expect(saved.cie11Code).toBe('6B00');
    expect(saved.cie11Title).toBe('Trastorno de ansiedad generalizada'); // del catálogo
    expect(saved.status).toBe('activo');
    expect(saved.patientId).toBe('pac-1');
  });

  it('lanza si el código CIE-11 no está en el catálogo', async () => {
    const repo = new InMemoryDiagnoses();
    await expect(
      new RegisterDiagnosis(repo, catalogWithEntry()).execute(
        new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: 'ZZZZ', notes: '' }),
      ),
    ).rejects.toThrow();
    expect(repo.items).toHaveLength(0);
  });
});

describe('UpdateDiagnosisStatus (caso de uso)', () => {
  it('actualiza el estado de un diagnóstico del paciente', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );
    await new UpdateDiagnosisStatus(repo).execute(id, 'pac-1', 'remitido');
    expect((await repo.findById(id))!.toPrimitives().status).toBe('remitido');
  });

  it('[scoping] rechaza actualizar un diagnóstico de OTRO paciente con DiagnosisNotFoundError', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );
    await expect(new UpdateDiagnosisStatus(repo).execute(id, 'pac-2', 'remitido')).rejects.toThrow(
      DiagnosisNotFoundError,
    );
    // No se mutó el estado original.
    expect((await repo.findById(id))!.toPrimitives().status).toBe('activo');
  });

  it('[error] propaga InvalidDiagnosisStatusError con un estado inválido', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );
    await expect(new UpdateDiagnosisStatus(repo).execute(id, 'pac-1', 'inventado')).rejects.toThrow(
      InvalidDiagnosisStatusError,
    );
    expect((await repo.findById(id))!.toPrimitives().status).toBe('activo');
  });
});

describe('ListDiagnoses (caso de uso)', () => {
  it('devuelve sólo los diagnósticos del paciente, más recientes primero', async () => {
    const repo = new InMemoryDiagnoses();
    await repo.save(
      Diagnosis.fromPrimitives({
        id: 'dx-viejo',
        patientId: 'pac-1',
        cie11Code: '6B00',
        cie11Title: 'TAG',
        notes: '',
        status: 'activo',
        kind: 'hipotesis',
        diagnosedByUserId: '',
        diagnosedAt: '2024-01-01T00:00:00.000Z',
      }),
    );
    await repo.save(
      Diagnosis.fromPrimitives({
        id: 'dx-nuevo',
        patientId: 'pac-1',
        cie11Code: '6B00',
        cie11Title: 'TAG',
        notes: '',
        status: 'activo',
        kind: 'hipotesis',
        diagnosedByUserId: '',
        diagnosedAt: '2025-01-01T00:00:00.000Z',
      }),
    );
    await repo.save(
      Diagnosis.fromPrimitives({
        id: 'dx-ajeno',
        patientId: 'pac-2',
        cie11Code: '6B00',
        cie11Title: 'TAG',
        notes: '',
        status: 'activo',
        kind: 'hipotesis',
        diagnosedByUserId: '',
        diagnosedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    const result = await new ListDiagnoses(repo).execute('pac-1');
    expect(result.map((d) => d.id)).toEqual(['dx-nuevo', 'dx-viejo']);
  });
});

describe('SetDiagnosisFormality (caso de uso · gate de licencia)', () => {
  it('confirma como FORMAL si el perfil tiene tarjeta y ata al responsable', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );

    await new SetDiagnosisFormality(repo, identityReader('TP-123')).execute({
      diagnosisId: id,
      patientId: 'pac-1',
      kind: 'formal',
      actorUserId: 'profesional-9',
    });

    const saved = (await repo.findById(id))!.toPrimitives();
    expect(saved.kind).toBe('formal');
    expect(saved.diagnosedByUserId).toBe('profesional-9');
  });

  it('RECHAZA confirmar como formal sin tarjeta profesional (practicante)', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );

    await expect(
      new SetDiagnosisFormality(repo, identityReader('')).execute({
        diagnosisId: id,
        patientId: 'pac-1',
        kind: 'formal',
        actorUserId: 'practicante-1',
      }),
    ).rejects.toThrow(ProfessionalLicenseRequiredError);
    // Sigue siendo hipótesis: nadie sin licencia afirmó el diagnóstico.
    expect((await repo.findById(id))!.toPrimitives().kind).toBe('hipotesis');
  });

  it('degradar a hipótesis NO exige licencia (acto conservador)', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );
    await new SetDiagnosisFormality(repo, identityReader('TP-123')).execute({
      diagnosisId: id,
      patientId: 'pac-1',
      kind: 'formal',
      actorUserId: 'profesional-9',
    });

    // Sin licencia (perfil vacío) se puede DEGRADAR a hipótesis.
    await new SetDiagnosisFormality(repo, identityReader('')).execute({
      diagnosisId: id,
      patientId: 'pac-1',
      kind: 'hipotesis',
      actorUserId: 'practicante-1',
    });
    expect((await repo.findById(id))!.toPrimitives().kind).toBe('hipotesis');
  });

  it('[scoping] rechaza un diagnóstico de OTRO paciente', async () => {
    const repo = new InMemoryDiagnoses();
    const id = await new RegisterDiagnosis(repo, catalogWithEntry()).execute(
      new RegisterDiagnosisMessage({ patientId: 'pac-1', cie11Code: '6B00', notes: '' }),
    );
    await expect(
      new SetDiagnosisFormality(repo, identityReader('TP-123')).execute({
        diagnosisId: id,
        patientId: 'pac-2',
        kind: 'formal',
        actorUserId: 'profesional-9',
      }),
    ).rejects.toThrow(DiagnosisNotFoundError);
  });
});
