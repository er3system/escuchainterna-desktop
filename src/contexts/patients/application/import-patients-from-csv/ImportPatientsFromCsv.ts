import Papa from 'papaparse';
import { DomainError } from '@/shared/domain/DomainError';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { PatientPhone } from '../../domain/value-objects/PatientPhone';
import { CreatePatient } from '../create-patient/CreatePatient';
import { CreatePatientMessage } from '../create-patient/CreatePatientMessage';

export interface CsvRowIssue {
  fila: number;
  motivo: string;
}

export interface ImportPatientsResult {
  importados: number;
  errores: CsvRowIssue[];
  advertencias: CsvRowIssue[];
}

/** Encabezados canónicos aceptados (flexibles con mayúsculas y acentos). */
const HEADER_ALIASES: Record<string, string> = {
  nombre: 'nombre',
  nombre_completo: 'nombre',
  paciente: 'nombre',
  nombre_del_paciente: 'nombre',
  correo: 'correo',
  email: 'correo',
  correo_electronico: 'correo',
  'e-mail': 'correo',
  mail: 'correo',
  telefono: 'telefono',
  celular: 'telefono',
  tel: 'telefono',
  movil: 'telefono',
  whatsapp: 'telefono',
  numero_de_telefono: 'telefono',
  fecha_nacimiento: 'fecha_nacimiento',
  fecha_de_nacimiento: 'fecha_nacimiento',
  nacimiento: 'fecha_nacimiento',
  contacto_emergencia: 'contacto_emergencia',
  contacto_de_emergencia: 'contacto_emergencia',
  telefono_emergencia: 'telefono_emergencia',
  telefono_de_emergencia: 'telefono_emergencia',
  celular_emergencia: 'telefono_emergencia',
  notas: 'notas',
  nota: 'notas',
  comentarios: 'notas',
  observaciones: 'notas',
  genero: 'genero',
  sexo: 'genero',
  motivo_consulta: 'motivo_consulta',
  motivo_de_consulta: 'motivo_consulta',
  motivo: 'motivo_consulta',
  fecha_inicio_terapia: 'fecha_inicio_terapia',
  fecha_de_inicio_de_terapia: 'fecha_inicio_terapia',
  inicio_terapia: 'fecha_inicio_terapia',
  etiquetas: 'etiquetas',
  tags: 'etiquetas',
};

function normalizeHeader(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  return HEADER_ALIASES[cleaned] ?? cleaned;
}

type CsvRow = Record<string, string | undefined>;

export class ImportPatientsFromCsv {
  private readonly createPatient: CreatePatient;

  public constructor(patients: PatientRepository) {
    this.createPatient = new CreatePatient(patients);
  }

  public async importFromContent(csvContent: string): Promise<ImportPatientsResult> {
    const result: ImportPatientsResult = { importados: 0, errores: [], advertencias: [] };

    const parsed = Papa.parse<CsvRow>(csvContent.replace(/^\uFEFF/, ''), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
    });

    const headers = parsed.meta.fields ?? [];
    if (!headers.includes('nombre')) {
      result.errores.push({
        fila: 1,
        motivo: 'no se encontró la columna «nombre»: revisa los encabezados del archivo',
      });
      return result;
    }
    if (parsed.data.length === 0) {
      result.errores.push({ fila: 2, motivo: 'el archivo no contiene filas de datos' });
      return result;
    }

    const malformedRows = new Set<number>();
    for (const parseError of parsed.errors) {
      if (typeof parseError.row !== 'number') continue;
      const fila = parseError.row + 2; // fila 1 = encabezados
      if (malformedRows.has(fila)) continue;
      malformedRows.add(fila);
      result.errores.push({ fila, motivo: 'fila mal formada: revisa comas y comillas' });
    }

    // Secuencial (for + await): cada alta escribe en BD; no se paralelizan los inserts.
    let index = 0;
    for (const row of parsed.data) {
      const fila = index + 2; // fila 1 = encabezados
      index += 1;
      if (malformedRows.has(fila)) continue;

      try {
        const message = new CreatePatientMessage({
          fullName: row.nombre ?? '',
          email: row.correo ?? '',
          phone: row.telefono ?? '',
          birthDate: row.fecha_nacimiento ?? null,
          gender: row.genero ?? '',
          consultationReason: row.motivo_consulta ?? '',
          therapyStartDate: row.fecha_inicio_terapia ?? null,
          emergencyContactName: row.contacto_emergencia ?? '',
          emergencyContactPhone: row.telefono_emergencia ?? '',
          notes: row.notas ?? '',
          tags: (row.etiquetas ?? '')
            .split(/[;|]/)
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        });
        await this.createPatient.create(message);
        result.importados += 1;

        const phone = new PatientPhone(row.telefono ?? '');
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
