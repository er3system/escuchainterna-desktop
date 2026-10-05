import { PublicationPrimitives } from '../../domain/Publication';
import { PublicationRepository } from '../../domain/repositories/PublicationRepository';
import { SearchPublicationsQuery } from './SearchPublicationsQuery';

export interface PublicationCatalog {
  publications: PublicationPrimitives[];
  total: number;
  categories: Array<{ category: string; total: number }>;
}

export class SearchPublications {
  public constructor(private readonly repository: PublicationRepository) {}

  public async search(query: SearchPublicationsQuery): Promise<PublicationCatalog> {
    const criteria = query.toCriteria();
    const [publications, total, categories] = await Promise.all([
      this.repository.search(criteria),
      this.repository.countMatching(criteria),
      this.repository.listCategories(),
    ]);
    return {
      publications: publications.map((publication) => publication.toPrimitives()),
      total,
      categories,
    };
  }
}
