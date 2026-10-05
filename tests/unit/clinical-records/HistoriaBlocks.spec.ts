import { describe, it, expect } from 'vitest';
import {
  BLOCK_CATEGORIES,
  HISTORIA_NUCLEO_TEMPLATE_ID,
  allRelevantModelsAreValid,
  historiaBlockCatalog,
  historiaBlockCategories,
  historiaNucleoSections,
  searchHistoriaBlocks,
} from '@/contexts/clinical-records/domain/historiaBlocks';

describe('historiaBlocks — catálogo CURADO del expediente v2 (§4)', () => {
  it('el catálogo es curado, con ids namespaced "bloque:" y contrato completo', () => {
    const catalog = historiaBlockCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(20);
    for (const block of catalog) {
      expect(block.id.startsWith('bloque:')).toBe(true);
      expect(BLOCK_CATEGORIES).toContain(block.category);
      expect(block.title).toBeTruthy();
      expect(block.description).toBeTruthy();
      expect(block.addableIn.length).toBeGreaterThan(0);
      expect(Array.isArray(block.relevantModels)).toBe(true);
      expect(typeof block.hasContinuation).toBe('boolean');
      expect(block.section.fields.length).toBeGreaterThan(0);
    }
    // Ids únicos.
    expect(new Set(catalog.map((b) => b.id)).size).toBe(catalog.length);
  });

  it('ningún bloque proviene de la plantilla del núcleo (una sola fuente)', () => {
    const catalog = historiaBlockCatalog();
    expect(catalog.every((b) => !b.id.startsWith(`bloque:${HISTORIA_NUCLEO_TEMPLATE_ID}`))).toBe(true);
  });

  it('los relevantModels son keys de modelo válidas', () => {
    expect(allRelevantModelsAreValid()).toBe(true);
  });

  it('hay exactamente 5 técnicas con seguimiento (hilos §5)', () => {
    const conSeguimiento = historiaBlockCatalog().filter((b) => b.hasContinuation);
    expect(conSeguimiento).toHaveLength(5);
    const ids = conSeguimiento.map((b) => b.id);
    expect(ids).toContain('bloque:jerarquia-exposicion');
    expect(ids).toContain('bloque:analisis-funcional-abc');
    expect(ids).toContain('bloque:activacion-programacion');
    expect(ids).toContain('bloque:habilidades-dbt');
    expect(ids).toContain('bloque:autorregistro-tareas');
  });

  it('la anamnesis base se pregunta POR DEFECTO en el núcleo, no como bloque (fuente única §2)', () => {
    const nucleoIds = new Set(historiaNucleoSections().map((s) => s.id));
    const anamnesisIds = [
      'historia-problema-actual',
      'historia-desarrollo',
      'dinamica-familiar-apoyo',
      'habitos-estilo-vida',
    ];
    for (const id of anamnesisIds) {
      // Está en el núcleo por defecto…
      expect(nucleoIds.has(id), `núcleo incluye ${id}`).toBe(true);
      // …y NO se duplica como bloque añadible.
      expect(historiaBlockCatalog().some((b) => b.id === `bloque:${id}`), `${id} no es bloque`).toBe(false);
    }
    // El núcleo se puede buscar/usar; estas secciones quedan disponibles de entrada.
    expect(historiaNucleoSections().length).toBeGreaterThanOrEqual(8);
  });

  it('las categorías cubren las 4 familias del §4', () => {
    const categories = historiaBlockCategories();
    expect(categories).toEqual(['Evaluación', 'Técnica', 'Proceso', 'Estructural']);
  });

  it('el núcleo por defecto sale de "Historia general (adultos)" y no va vacío', () => {
    const nucleo = historiaNucleoSections();
    expect(nucleo.length).toBeGreaterThan(0);
    expect(nucleo.every((s) => s.id !== 'notas-adicionales')).toBe(true);
    expect(HISTORIA_NUCLEO_TEMPLATE_ID).toBe('builtin-historia-general');
  });

  it('busca bloques por texto sin acentos (análisis funcional, genograma)', () => {
    expect(searchHistoriaBlocks('analisis funcional').length).toBeGreaterThan(0);
    expect(searchHistoriaBlocks('genograma').length).toBeGreaterThan(0);
    // También por etiqueta de campo.
    expect(searchHistoriaBlocks('milagro').length).toBeGreaterThan(0);
  });

  it('filtra por categoría y combina con texto', () => {
    const tecnicas = searchHistoriaBlocks('', 'Técnica');
    expect(tecnicas.length).toBeGreaterThan(0);
    expect(tecnicas.every((b) => b.category === 'Técnica')).toBe(true);
    // El genograma es Evaluación, no Técnica → vacío.
    expect(searchHistoriaBlocks('genograma', 'Técnica')).toHaveLength(0);
  });

  it('sin query devuelve todo el catálogo', () => {
    expect(searchHistoriaBlocks('')).toHaveLength(historiaBlockCatalog().length);
  });
});
