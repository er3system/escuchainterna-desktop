import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface ConsultorioPrimitives {
  id: string;
  organizationId: string;
  name: string;
  archived: boolean;
  createdAt: string;
}

/**
 * Consultorio: sub-unidad OPCIONAL dentro de una organización (sede, grupo
 * clínico). En Fase 1 solo guarda la pertenencia (ver docs/consultorios-spec.md);
 * el aislamiento de datos clínicos llega en una fase posterior.
 */
export class Consultorio extends AggregateRoot {
  private constructor(private readonly value: ConsultorioPrimitives) {
    super();
  }

  public static create(id: string, organizationId: string, name: string): Consultorio {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('El nombre del consultorio es obligatorio.');
    return new Consultorio({
      id,
      organizationId,
      name: trimmed,
      archived: false,
      createdAt: new Date().toISOString(),
    });
  }

  public static fromPrimitives(primitives: ConsultorioPrimitives): Consultorio {
    return new Consultorio({ ...primitives });
  }

  public consultorioId(): string {
    return this.value.id;
  }

  public consultorioOrganizationId(): string {
    return this.value.organizationId;
  }

  public rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('El nombre del consultorio es obligatorio.');
    this.value.name = trimmed;
  }

  public archive(): void {
    this.value.archived = true;
  }

  public toPrimitives(): ConsultorioPrimitives {
    return { ...this.value };
  }
}
