import { PublicationSearchCriteria } from '../../domain/repositories/PublicationRepository';

export class SearchPublicationsQuery {
  public constructor(
    private readonly text: string,
    private readonly category: string,
    private readonly country: string,
    private readonly onlyFavorites: boolean,
  ) {}

  public static fromPrimitives(input: {
    text?: string;
    category?: string;
    country?: string;
    onlyFavorites?: boolean;
  }): SearchPublicationsQuery {
    return new SearchPublicationsQuery(
      (input.text ?? '').trim(),
      (input.category ?? '').trim(),
      (input.country ?? '').trim(),
      input.onlyFavorites ?? false,
    );
  }

  public toCriteria(): PublicationSearchCriteria {
    return {
      text: this.text || undefined,
      category: this.category || undefined,
      // El sub-filtro por país solo aplica dentro de una categoría (Marcos normativos).
      country: this.category ? this.country || undefined : undefined,
      onlyFavorites: this.onlyFavorites || undefined,
    };
  }
}
