/**
 * Normaliza texto para búsqueda de pacientes: sin acentos, minúsculas, recortado.
 * Compartido por los selectores de Vínculos (pareja/familia) para que "José" y
 * "jose" coincidan. Función pura (sin 'use client'): reutilizable en cualquier lado.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
