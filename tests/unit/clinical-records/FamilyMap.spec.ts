import { describe, expect, it } from 'vitest';
import { FamilyMap } from '@/contexts/clinical-records/domain/FamilyMap';
import {
  FAMILY_MAP_CANVAS,
  isDirectedLink,
  normalizeFamilyMapData,
} from '@/contexts/clinical-records/domain/value-objects/familyMapElements';

const EMPTY = { members: [], links: [], patterns: [] };

describe('normalizeFamilyMapData', () => {
  it('descarta miembros sin nombre o sin id y vínculos hacia miembros inexistentes', () => {
    const data = normalizeFamilyMapData({
      members: [
        { id: 'a', name: 'Madre', gender: 'femenino', x: 100, y: 100 },
        { id: 'b', name: '   ', gender: 'masculino', x: 100, y: 100 },
        { name: 'Sin id', gender: 'otro', x: 100, y: 100 },
      ],
      links: [
        { id: 'l1', fromId: 'a', toId: 'b', kind: 'matrimonio' },
        { id: 'l2', fromId: 'a', toId: 'a', kind: 'conflicto' },
      ],
    });
    expect(data.members.map((member) => member.id)).toEqual(['a']);
    expect(data.links).toEqual([]);
  });

  it('acota posiciones al lienzo y normaliza género/vínculo desconocidos', () => {
    const data = normalizeFamilyMapData({
      members: [
        { id: 'a', name: 'Padre', gender: 'marciano', x: -500, y: 99999 },
        { id: 'b', name: 'Hija', gender: 'femenino', x: 200, y: 200, age: 7.9 },
      ],
      links: [{ id: 'l1', fromId: 'a', toId: 'b', kind: 'tipo-raro' }],
    });
    expect(data.members[0].gender).toBe('otro');
    expect(data.members[0].x).toBe(40);
    expect(data.members[0].y).toBe(FAMILY_MAP_CANVAS.height - 40);
    expect(data.members[1].age).toBe(7);
    expect(data.links[0].kind).toBe('matrimonio');
  });

  it('rellena con valores por defecto los atributos nuevos (compat. hacia atrás)', () => {
    const data = normalizeFamilyMapData({
      members: [{ id: 'a', name: 'Abuela', gender: 'femenino', x: 100, y: 100 }],
      links: [],
    });
    const m = data.members[0];
    expect(m.identifiedPatient).toBe(false);
    expect(m.deceasedYear).toBeNull();
    expect(m.conditions).toEqual([]);
    expect(m.role).toBe('');
    expect(m.household).toBe(false);
    expect(m.notes).toBe('');
  });

  it('conserva los atributos ricos válidos del miembro y filtra condiciones inválidas', () => {
    const data = normalizeFamilyMapData({
      members: [
        {
          id: 'a',
          name: 'PI',
          gender: 'masculino',
          x: 200,
          y: 200,
          identifiedPatient: true,
          deceased: true,
          deceasedYear: 2019,
          conditions: ['salud_mental', 'consumo', 'inventada', 'salud_mental'],
          role: 'chivo expiatorio',
          household: true,
          notes: 'hipótesis: portador del síntoma',
        },
      ],
      links: [],
    });
    const m = data.members[0];
    expect(m.identifiedPatient).toBe(true);
    expect(m.deceasedYear).toBe(2019);
    expect(m.conditions).toEqual(['salud_mental', 'consumo']); // dedup + filtra inválidas
    expect(m.role).toBe('chivo expiatorio');
    expect(m.household).toBe(true);
  });

  it('deceasedYear solo se conserva si el miembro está fallecido', () => {
    const data = normalizeFamilyMapData({
      members: [{ id: 'a', name: 'Vivo', gender: 'masculino', x: 100, y: 100, deceased: false, deceasedYear: 2000 }],
      links: [],
    });
    expect(data.members[0].deceasedYear).toBeNull();
  });

  it('violenceType solo aplica a vínculos de violencia y normaliza el resto', () => {
    const data = normalizeFamilyMapData({
      members: [
        { id: 'a', name: 'A', gender: 'masculino', x: 100, y: 100 },
        { id: 'b', name: 'B', gender: 'femenino', x: 300, y: 100 },
      ],
      links: [
        { id: 'l1', fromId: 'a', toId: 'b', kind: 'violencia', violenceType: 'coercitiva', notes: 'control económico' },
        { id: 'l2', fromId: 'a', toId: 'b', kind: 'cercania', violenceType: 'coercitiva' },
      ],
    });
    expect(data.links[0].violenceType).toBe('coercitiva');
    expect(data.links[0].notes).toBe('control económico');
    expect(data.links[1].violenceType).toBe(''); // no es violencia → se limpia
  });

  it('normaliza patrones: exige tipo válido y ≥2 miembros existentes', () => {
    const data = normalizeFamilyMapData({
      members: [
        { id: 'a', name: 'A', gender: 'masculino', x: 100, y: 100 },
        { id: 'b', name: 'B', gender: 'femenino', x: 300, y: 100 },
        { id: 'c', name: 'C', gender: 'otro', x: 500, y: 100 },
      ],
      links: [],
      patterns: [
        { id: 'p1', kind: 'triangulacion', memberIds: ['a', 'b', 'c'] },
        { id: 'p2', kind: 'coalicion', memberIds: ['a'] }, // <2 → descarta
        { id: 'p3', kind: 'inventado', memberIds: ['a', 'b'] }, // tipo inválido → descarta
        { id: 'p4', kind: 'alianza', memberIds: ['a', 'zzz'] }, // un miembro inexistente → queda con 1 → descarta
      ],
    });
    expect(data.patterns).toHaveLength(1);
    expect(data.patterns[0].kind).toBe('triangulacion');
    expect(data.patterns[0].memberIds).toEqual(['a', 'b', 'c']);
  });

  it('devuelve estructura vacía ante basura', () => {
    expect(normalizeFamilyMapData(null)).toEqual(EMPTY);
    expect(normalizeFamilyMapData('texto')).toEqual(EMPTY);
    expect(normalizeFamilyMapData(42)).toEqual(EMPTY);
  });
});

describe('isDirectedLink', () => {
  it('marca como dirigidas filiación, violencia, control y cuidado', () => {
    expect(isDirectedLink('hijo')).toBe(true);
    expect(isDirectedLink('violencia')).toBe(true);
    expect(isDirectedLink('control')).toBe(true);
    expect(isDirectedLink('cuidado')).toBe(true);
    expect(isDirectedLink('matrimonio')).toBe(false);
    expect(isDirectedLink('conflicto')).toBe(false);
  });
});

describe('FamilyMap', () => {
  it('se crea vacío con título por defecto cuando viene en blanco', () => {
    const map = FamilyMap.create({ id: 'map-1', patientId: 'pac-1', title: '   ' });
    const primitives = map.toPrimitives();
    expect(primitives.title).toBe('Mapa familiar');
    expect(primitives.data).toEqual(EMPTY);
    expect(map.belongsTo('pac-1')).toBe(true);
    expect(map.belongsTo('pac-2')).toBe(false);
  });

  it('replaceData normaliza el dato crudo (posiciones, patrones) y actualiza updatedAt', () => {
    const map = FamilyMap.create({ id: 'map-1', patientId: 'pac-1', title: 'Familia nuclear' });
    map.replaceData({
      members: [
        { id: 'a', name: 'Paciente', relation: 'paciente', gender: 'masculino', x: 300, y: 200, identifiedPatient: true },
        { id: 'b', name: 'Pareja', relation: 'pareja', gender: 'femenino', x: 500, y: 200 },
      ],
      links: [{ id: 'l1', fromId: 'a', toId: 'b', kind: 'cercania' }],
      patterns: [{ id: 'p1', kind: 'alianza', memberIds: ['a', 'b'] }],
    });
    const primitives = map.toPrimitives();
    expect(primitives.data.members).toHaveLength(2);
    expect(primitives.data.members[0].x).toBe(300);
    expect(primitives.data.members[0].identifiedPatient).toBe(true);
    expect(primitives.data.links[0].kind).toBe('cercania');
    expect(primitives.data.patterns[0].kind).toBe('alianza');
  });

  it('rename ignora títulos vacíos', () => {
    const map = FamilyMap.create({ id: 'map-1', patientId: 'pac-1', title: 'Original' });
    map.rename('   ');
    expect(map.toPrimitives().title).toBe('Original');
    map.rename('Genograma 2026');
    expect(map.toPrimitives().title).toBe('Genograma 2026');
  });
});
