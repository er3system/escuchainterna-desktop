import Papa from 'papaparse';
import { stripBom } from './decodeCsvBytes';
import { suggestTargetForHeader, type ImportColumnTarget } from './importFields';

/**
 * Análisis previo del CSV para la pantalla de mapeo (v3 §3): detecta el
 * separador (`,` o `;`, también tab y `|`), lee los encabezados, sugiere un
 * destino por columna y arma la vista previa de las primeras 5 filas.
 */

export interface CsvColumnAnalysis {
  index: number;
  /** Encabezado original («Columna N» si la celda venía vacía). */
  header: string;
  suggestion: ImportColumnTarget;
  /** Hasta 2 valores no vacíos de ejemplo para orientar el mapeo. */
  samples: string[];
}

export interface CsvAnalysis {
  ok: boolean;
  error?: string;
  delimiter: string;
  totalRows: number;
  columns: CsvColumnAnalysis[];
  /** Primeras 5 filas de datos, alineadas con `columns` por índice. */
  previewRows: string[][];
}

export const CSV_PREVIEW_ROWS = 5;

function failure(error: string): CsvAnalysis {
  return { ok: false, error, delimiter: ',', totalRows: 0, columns: [], previewRows: [] };
}

export function analyzeCsv(content: string): CsvAnalysis {
  const clean = stripBom(content);
  if (!clean.trim()) return failure('El archivo está vacío.');

  const parsed = Papa.parse<string[]>(clean, {
    header: false,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t', '|'],
  });

  const rows = parsed.data.filter((row) => Array.isArray(row));
  if (rows.length === 0) return failure('No se pudo leer ninguna fila del archivo.');

  const headerRow = rows[0].map((cell) => (cell ?? '').trim());
  const dataRows = rows.slice(1);
  if (headerRow.every((cell) => cell === '')) {
    return failure('La primera fila debe contener los encabezados de las columnas.');
  }
  if (dataRows.length === 0) {
    return failure('El archivo no contiene filas de datos (solo encabezados).');
  }

  const columns: CsvColumnAnalysis[] = headerRow.map((rawHeader, index) => {
    const header = rawHeader || `Columna ${index + 1}`;
    const samples: string[] = [];
    for (const row of dataRows) {
      const value = (row[index] ?? '').trim();
      if (value) samples.push(value);
      if (samples.length >= 2) break;
    }
    return { index, header, suggestion: rawHeader ? suggestTargetForHeader(rawHeader) : 'ignorar', samples };
  });

  const previewRows = dataRows
    .slice(0, CSV_PREVIEW_ROWS)
    .map((row) => columns.map((column) => (row[column.index] ?? '').trim()));

  return {
    ok: true,
    delimiter: parsed.meta.delimiter || ',',
    totalRows: dataRows.length,
    columns,
    previewRows,
  };
}
