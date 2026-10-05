import Papa from 'papaparse';
import { DomainError } from '@/shared/domain/DomainError';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { PatientPhone } from '../../domain/value-objects/PatientPhone';
import { CreatePatient } from '../create-patient/CreatePatient';
import { CreatePatientMessage } from '../create-patient/CreatePatientMessage';
import { stripBom } from './decodeCsvBytes';
import {
  importFieldLabel,
  type ImportColumnMapping,
  type ImportPatientFieldId,
} from './importFields';

/**
 * Importación flexible con mapeo de columnas (v3 §3, universidades): el
 * usuario decide qué columna alimenta cada campo del paciente y qué columnas
 * se conservan como etiquetas institucionales «Columna: valor»
 * (p. ej. «Programa: Psicología», «Semestre: 6», «Código: 2021-1234»).
 */

export interface ImportRowIssue {
  fila: number;
  motivo: string;
}

export interface FlexibleImportResult {
  importados: number;
  errores: ImportRowIssue[];
  advertencias: ImportRowIssue[];
}

/** «15/04/1992», «15-04-1992» o «1992/04/15» → «1992-04-15» (AAAA-MM-DD). */
export function normalizeDateValue(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const dayFirst = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  const yearFirst = value.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2].padStart(2, '0')}-${yearFirst[3].padStart(2, '0')}`;
  return value; // CalendarDate valida y reporta el formato exacto.
}

/** «57», «0057» o «+57» → «+57». Vacío ⇒ '' (se usa el default del dominio). */
export function normalizeDialCode(raw: string): string {
  const digits = raw.trim().replace(/^\+/, '').replace(/^00/, '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export class ImportPatientsWithMapping {
  private readonly createPatient: CreatePatient;

  public constructor(patients: PatientRepository) {
    this.createPatient = new CreatePatient(patients);
  }

  public async import(
    csvContent: string,
    mapping: ImportColumnMapping[],
  ): Promise<FlexibleImportResult> {
    const result: FlexibleImportResult = { importados: 0, errores: [], advertencias: [] };

    const mappingError = validateMapping(mapping);
    if (mappingError) {
      result.errores.push({ fila: 1, motivo: mappingError });
      return result;
    }

    const parsed = Papa.parse<string[]>(stripBom(csvContent), {
      header: false,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t', '|'],
    });

    const rows = parsed.data.filter((row) => Array.isArray(row));
    const dataRows = rows.slice(1); // fila 1 = encabezados
    if (dataRows.length === 0) {
      result.errores.push({ fila: 2, motivo: 'el archivo no contiene filas de datos' });
      return result;
    }

    const fieldColumns = new Map<ImportPatientFieldId, number>();
    const tagColumns: Array<{ index: number; header: string }> = [];
    for (const column of mapping) {
      if (column.target === 'ignorar') continue;
      if (column.target === 'etiqueta') {
        tagColumns.push({ index: column.index, header: column.header.trim() || `Columna ${column.index + 1}` });
      } else {
        fieldColumns.set(column.target, column.index);
      }
    }

    const cell = (row: string[], fieldId: ImportPatientFieldId): string => {
      const index = fieldColumns.get(fieldId);
      if (index === undefined) return '';
      return (row[index] ?? '').trim();
    };

    // Secuencial (for + await): cada alta escribe en BD; no se paralelizan los inserts.
    let dataIndex = 0;
    for (const row of dataRows) {
      const fila = dataIndex + 2; // fila 1 = encabezados
      dataIndex += 1;
      try {
        const phoneValue = cell(row, 'telefono');
        const dialCode = normalizeDialCode(cell(row, 'lada'));
        const tags = tagColumns
          .map(({ index, header }) => {
            const value = (row[index] ?? '').trim();
            return value ? `${header}: ${value}` : '';
          })
          .filter((tag) => tag.length > 0);

        const message = new CreatePatientMessage({
          fullName: cell(row, 'nombre'),
          email: cell(row, 'correo'),
          phone: phoneValue,
          phoneCountryCode: dialCode || undefined,
          birthDate: normalizeDateValue(cell(row, 'fecha_nacimiento')) || null,
          gender: cell(row, 'genero'),
          emergencyContactName: cell(row, 'contacto_emergencia'),
          emergencyContactPhone: cell(row, 'telefono_emergencia'),
          notes: cell(row, 'notas'),
          tags,
        });
        await this.createPatient.create(message);
        result.importados += 1;

        const phone = new PatientPhone(phoneValue);
        if (!phone.isEmpty() && !phone.isValidForWhatsApp()) {
          result.advertencias.push({
            fila,
            motivo: `teléfono inválido («${phone.toString()}»): sin un teléfono válido el paciente no recibirá mensajes de WhatsApp`,
          });
        }
      } catch (error) {
        const motivo =
          error instanceof DomainError
            ? error.message
            : 'fila inválida: no se pudo procesar el registro';
        result.errores.push({ fila, motivo });
      }
    }

    return result;
  }
}

/** null ⇒ mapeo válido; string ⇒ motivo del rechazo (antes de tocar filas). */
function validateMapping(mapping: ImportColumnMapping[]): string | null {
  if (mapping.length === 0) return 'no se recibió el mapeo de columnas';

  const counts = new Map<ImportPatientFieldId, number>();
  for (const column of mapping) {
    if (column.target === 'etiqueta' || column.target === 'ignorar') continue;
    counts.set(column.target, (counts.get(column.target) ?? 0) + 1);
  }

  if (!counts.has('nombre')) {
    return 'asigna una columna al campo «Nombre completo» para poder importar';
  }
  for (const [fieldId, count] of counts) {
    if (count > 1) {
      return `el campo «${importFieldLabel(fieldId)}» está asignado a ${count} columnas: déjalo en una sola`;
    }
  }
  return null;
}
