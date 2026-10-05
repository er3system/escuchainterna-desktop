import { describe, it, expect, beforeEach } from 'vitest';
import { FamilyMap } from '@/contexts/clinical-records/domain/FamilyMap';
import type { FamilyMapRepository } from '@/contexts/clinical-records/domain/repositories/FamilyMapRepository';
import { FamilyMapNotFoundError } from '@/contexts/clinical-records/domain/errors/FamilyMapNotFoundError';
import { CreateFamilyMap } from '@/contexts/clinical-records/application/create-family-map/CreateFamilyMap';
import { SaveFamilyMap } from '@/contexts/clinical-records/application/save-family-map/SaveFamilyMap';
import { SaveFamilyMapMessage } from '@/contexts/clinical-records/application/save-family-map/SaveFamilyMapMessage';
import { DeleteFamilyMap } from '@/contexts/clinical-records/application/delete-family-map/DeleteFamilyMap';
import { ListFamilyMaps } from '@/contexts/clinical-records/application/list-family-maps/ListFamilyMaps';

class InMemoryFamilyMaps implements FamilyMapRepository {
  public readonly maps: FamilyMap[] = [];

  public async save(map: FamilyMap): Promise<void> {
    const i = this.maps.findIndex((m) => m.mapId() === map.mapId());
    if (i >= 0) this.maps[i] = map;
    else this.maps.push(map);
  }

  public async findById(id: string): Promise<FamilyMap | null> {
    return this.maps.find((m) => m.mapId() === id) ?? null;
  }

  public async listByPatient(patientId: string): Promise<FamilyMap[]> {
    return this.maps.filter((m) => m.belongsTo(patientId));
  }

  public async delete(id: string): Promise<void> {
    const i = this.maps.findIndex((m) => m.mapId() === id);
    if (i >= 0) this.maps.splice(i, 1);
  }
}

/** Dato crudo de la UI con basura que el agregado debe normalizar (no lo re-probamos a fondo aquí). */
function rawData() {
  return {
    members: [
      { id: 'a', name: 'Paciente', gender: 'masculino', x: 300, y: 200, identifiedPatient: true },
      { id: 'b', name: '   ', gender: 'femenino', x: 500, y: 200 }, // sin nombre → se descarta en el agregado
    ],
    links: [{ id: 'l1', fromId: 'a', toId: 'b', kind: 'cercania' }], // apunta a miembro descartado → se cae
  };
}

describe('CreateFamilyMap (capa de aplicación)', () => {
  let repo: InMemoryFamilyMaps;

  beforeEach(() => {
    repo = new InMemoryFamilyMaps();
  });

  it('crea un mapa asociado al paciente y devuelve su id', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Genograma nuclear');

    const saved = await repo.findById(id);
    expect(saved).not.toBeNull();
    expect(saved!.belongsTo('pac-1')).toBe(true);
    expect(saved!.toPrimitives().title).toBe('Genograma nuclear');
  });

  it('usa el título por defecto cuando viene en blanco (delegando al agregado)', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', '   ');

    expect((await repo.findById(id))!.toPrimitives().title).toBe('Mapa familiar');
  });
});

describe('SaveFamilyMap (capa de aplicación)', () => {
  let repo: InMemoryFamilyMaps;

  beforeEach(() => {
    repo = new InMemoryFamilyMaps();
  });

  it('[scoping] rechaza un mapa de otro paciente con FamilyMapNotFoundError sin tocarlo', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Original');
    const before = (await repo.findById(id))!.toPrimitives();

    const message = new SaveFamilyMapMessage({
      mapId: id,
      patientId: 'otro-paciente',
      title: 'Intruso',
      data: rawData(),
    });

    await expect(new SaveFamilyMap(repo).execute(message)).rejects.toThrow(FamilyMapNotFoundError);
    // No se renombró ni se reemplazó el dato.
    const after = (await repo.findById(id))!.toPrimitives();
    expect(after.title).toBe(before.title);
    expect(after.data.members).toHaveLength(0);
  });

  it('[scoping] lanza FamilyMapNotFoundError cuando el mapa no existe', async () => {
    const message = new SaveFamilyMapMessage({
      mapId: 'fantasma',
      patientId: 'pac-1',
      title: 'X',
      data: rawData(),
    });

    await expect(new SaveFamilyMap(repo).execute(message)).rejects.toThrow(FamilyMapNotFoundError);
  });

  it('si el mapa pertenece al paciente: renombra y reemplaza el dato (normalizado por el agregado)', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Original');

    const message = new SaveFamilyMapMessage({
      mapId: id,
      patientId: 'pac-1',
      title: 'Genograma 2026',
      data: rawData(),
    });
    await new SaveFamilyMap(repo).execute(message);

    const after = (await repo.findById(id))!.toPrimitives();
    expect(after.title).toBe('Genograma 2026');
    // El agregado normalizó: queda solo el miembro válido y el vínculo huérfano se descartó.
    expect(after.data.members.map((m) => m.id)).toEqual(['a']);
    expect(after.data.links).toEqual([]);
  });
});

describe('DeleteFamilyMap (capa de aplicación)', () => {
  let repo: InMemoryFamilyMaps;

  beforeEach(() => {
    repo = new InMemoryFamilyMaps();
  });

  it('[scoping] rechaza borrar un mapa de otro paciente y no lo elimina', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Original');

    await expect(new DeleteFamilyMap(repo).execute(id, 'otro-paciente')).rejects.toThrow(FamilyMapNotFoundError);
    expect(await repo.findById(id)).not.toBeNull();
  });

  it('borra un mapa que pertenece al paciente', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Original');

    await new DeleteFamilyMap(repo).execute(id, 'pac-1');

    expect(await repo.findById(id)).toBeNull();
  });
});

describe('ListFamilyMaps (capa de aplicación)', () => {
  let repo: InMemoryFamilyMaps;

  beforeEach(() => {
    repo = new InMemoryFamilyMaps();
  });

  it('solo devuelve los mapas del paciente pedido', async () => {
    const create = new CreateFamilyMap(repo);
    const a1 = await create.execute('pac-1', 'A1');
    const a2 = await create.execute('pac-1', 'A2');
    await create.execute('pac-2', 'B1');

    const summaries = await new ListFamilyMaps(repo).execute('pac-1');

    expect(summaries.map((s) => s.id).sort()).toEqual([a1, a2].sort());
    expect(summaries.every((s) => s.title === 'A1' || s.title === 'A2')).toBe(true);
  });

  it('devuelve resumen con conteos de miembros y vínculos tras guardar', async () => {
    const id = await new CreateFamilyMap(repo).execute('pac-1', 'Con datos');
    await new SaveFamilyMap(repo).execute(
      new SaveFamilyMapMessage({ mapId: id, patientId: 'pac-1', title: 'Con datos', data: rawData() }),
    );

    const [summary] = await new ListFamilyMaps(repo).execute('pac-1');

    expect(summary.memberCount).toBe(1); // 'b' sin nombre fue descartado por el agregado
    expect(summary.linkCount).toBe(0);
  });

  it('devuelve lista vacía cuando el paciente no tiene mapas', async () => {
    expect(await new ListFamilyMaps(repo).execute('pac-sin-mapas')).toEqual([]);
  });
});
