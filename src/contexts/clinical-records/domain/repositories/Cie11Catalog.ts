export interface Cie11Entry {
  code: string;
  title: string;
  parent: string | null;
  level: number;
  chapter: string;
}

export interface Cie11Catalog {
  searchByText(text: string, limit: number): Promise<Cie11Entry[]>;
  childrenOf(parentCode: string | null, chapter: string): Promise<Cie11Entry[]>;
  ancestorsOf(code: string): Promise<Cie11Entry[]>;
  findByCode(code: string): Promise<Cie11Entry | null>;
  totalEntries(): Promise<number>;
}
