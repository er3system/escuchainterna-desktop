import { AggregateRoot } from '@/shared/domain/AggregateRoot';

/** Categorías de la Colección EscuchaInterna (orden fijo de las pestañas). */
export const PUBLICATION_CATEGORIES = [
  'Modelos terapéuticos',
  'Temas clínicos',
  'Marcos normativos',
  'Pruebas e instrumentos',
] as const;

export type PublicationKind = 'modelo' | 'tema' | 'marco_normativo';

export interface PublicationPrimitives {
  id: string;
  title: string;
  summary: string;
  category: string;
  kind: PublicationKind;
  country: string;
  htmlPath: string;
  pdfPath: string;
  sources: string[];
  favorite: boolean;
  publishedAt: string;
  /** Sello "Revisada por el equipo clínico de EscuchaInterna" (v3 §8, lo otorga el admin). */
  reviewed: boolean;
  reviewedAt: string | null;
}

/**
 * Publicación original de la Colección EscuchaInterna (contenido de plataforma,
 * compartido por todos los profesionales: no lleva owner_user_id).
 */
export class Publication extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly title: string,
    private readonly summary: string,
    private readonly category: string,
    private readonly kind: PublicationKind,
    private readonly country: string,
    private readonly htmlPath: string,
    private readonly pdfPath: string,
    private readonly sources: string[],
    private favorite: boolean,
    private readonly publishedAt: Date,
    private reviewed: boolean,
    private reviewedAt: Date | null,
  ) {
    super();
  }

  public static fromPrimitives(
    primitives: Omit<PublicationPrimitives, 'reviewed' | 'reviewedAt'> &
      Partial<Pick<PublicationPrimitives, 'reviewed' | 'reviewedAt'>>,
  ): Publication {
    return new Publication(
      primitives.id,
      primitives.title,
      primitives.summary,
      primitives.category,
      primitives.kind,
      primitives.country,
      primitives.htmlPath,
      primitives.pdfPath,
      [...primitives.sources],
      primitives.favorite,
      new Date(primitives.publishedAt),
      primitives.reviewed ?? false,
      primitives.reviewedAt ? new Date(primitives.reviewedAt) : null,
    );
  }

  public markAsFavorite(): void {
    this.favorite = true;
  }

  public unmarkAsFavorite(): void {
    this.favorite = false;
  }

  public isFavorite(): boolean {
    return this.favorite;
  }

  /** Sello del equipo clínico: idempotente (conserva la fecha de la primera revisión). */
  public markAsReviewed(): void {
    if (this.reviewed) return;
    this.reviewed = true;
    this.reviewedAt = new Date();
  }

  /** Retira el sello (el admin puede revertir una revisión). */
  public unmarkAsReviewed(): void {
    this.reviewed = false;
    this.reviewedAt = null;
  }

  public isReviewed(): boolean {
    return this.reviewed;
  }

  public hasPdf(): boolean {
    return this.pdfPath.trim() !== '';
  }

  public toPrimitives(): PublicationPrimitives {
    return {
      id: this.id,
      title: this.title,
      summary: this.summary,
      category: this.category,
      kind: this.kind,
      country: this.country,
      htmlPath: this.htmlPath,
      pdfPath: this.pdfPath,
      sources: [...this.sources],
      favorite: this.favorite,
      publishedAt: this.publishedAt.toISOString(),
      reviewed: this.reviewed,
      reviewedAt: this.reviewedAt ? this.reviewedAt.toISOString() : null,
    };
  }
}
