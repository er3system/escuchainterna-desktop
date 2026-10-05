import Papa from 'papaparse';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { SearchPatientsQuery } from '../search-patients/SearchPatientsQuery';

/** Columnas compatibles con la importación (ida y vuelta sin pérdida). */
const EXPORT_COLUMNS = [
  'nombre',
  'correo',
  'telefono',
  'fecha_nacimiento',
  'genero',
  'motivo_consulta',
  'fecha_inicio_terapia',
  'contacto_emergencia',
  'telefono_emergencia',
  'notas',
  'etiquetas',
  'archivado',
] as const;

export class ExportPatientsCsv {
  public constructor(private readonly patients: PatientRepository) {}

  /** CSV UTF-8 con BOM para que Excel reconozca acentos. */
  public async exportAll(): Promise<string> {
    const found = await this.patients.search(new SearchPatientsQuery({ archived: 'todos' }).toCriteria());
    const rows = found
      .map((patient) => patient.toPrimitives())
      .map((primitives) => ({
        nombre: primitives.fullName,
        correo: primitives.email,
        telefono: primitives.phone,
        fecha_nacimiento: primitives.birthDate ?? '',
        genero: primitives.gender,
        motivo_consulta: primitives.consultationReason,
        fecha_inicio_terapia: primitives.therapyStartDate ?? '',
        contacto_emergencia: primitives.emergencyContactName,
        telefono_emergencia: primitives.emergencyContactPhone,
        notas: primitives.notes,
        etiquetas: primitives.tags.join('; '),
        archivado: primitives.archived ? 'sí' : 'no',
      }));

    const csv = Papa.unparse(rows, { columns: [...EXPORT_COLUMNS], newline: '\r\n' });
    return `\uFEFF${csv}`;
  }
}
