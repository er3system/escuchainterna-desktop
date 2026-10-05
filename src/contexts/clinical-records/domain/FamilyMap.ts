import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import {
  normalizeFamilyMapData,
  type FamilyMapData,
  type FamilyMapPrimitives,
} from './value-objects/familyMapElements';

/**
 * Mapa familiar (genograma) de un paciente: miembros con posición en el
 * lienzo y vínculos tipados entre ellos. Un paciente puede tener varios mapas.
 */
export class FamilyMap extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private title: string,
    private data: FamilyMapData,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static create(input: { id: string; patientId: string; title: string }): FamilyMap {
    const now = new Date();
    const title = input.title.trim() === '' ? 'Mapa familiar' : input.title.trim();
    return new FamilyMap(input.id, input.patientId, title, { members: [], links: [], patterns: [] }, now, now);
  }

  public static fromPrimitives(primitives: FamilyMapPrimitives): FamilyMap {
    return new FamilyMap(
      primitives.id,
      primitives.patientId,
      primitives.title,
      normalizeFamilyMapData(primitives.data),
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  /** Reemplaza miembros y vínculos (incluye posiciones tras arrastrar). */
  public replaceData(raw: unknown): void {
    this.data = normalizeFamilyMapData(raw);
    this.updatedAt = new Date();
  }

  public rename(title: string): void {
    if (title.trim() === '') return;
    this.title = title.trim();
    this.updatedAt = new Date();
  }

  public mapId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public toPrimitives(): FamilyMapPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      title: this.title,
      data: {
        members: this.data.members.map((member) => ({ ...member, conditions: [...member.conditions] })),
        links: this.data.links.map((link) => ({ ...link })),
        patterns: this.data.patterns.map((pattern) => ({ ...pattern, memberIds: [...pattern.memberIds] })),
      },
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
