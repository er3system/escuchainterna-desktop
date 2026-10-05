import { Publication } from '../Publication';

export interface PublicationSearchCriteria {
  text?: string;
  category?: string;
  country?: string;
  onlyFavorites?: boolean;
  /** Filtro por sello del equipo clínico (moderación admin). undefined = todas. */
  reviewed?: boolean;
}

export interface PublicationRepository {
  save(publication: Publication): Promise<void>;
  addToFavorites(publication: Publication): Promise<void>;
  removeFromFavorites(publication: Publication): Promise<void>;
  findById(id: string): Promise<Publication | null>;
  search(criteria: PublicationSearchCriteria): Promise<Publication[]>;
  countMatching(criteria: PublicationSearchCriteria): Promise<number>;
  listCategories(): Promise<Array<{ category: string; total: number }>>;
  /** Países con publicaciones dentro de una categoría (para el sub-filtro de Marcos normativos). */
  listCountries(category: string): Promise<Array<{ country: string; total: number }>>;
  totalPublications(): Promise<number>;
  countFavorites(): Promise<number>;
}
