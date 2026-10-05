'use server';

import { revalidatePath } from 'next/cache';
import { requireClinicalRecordAccessUserId } from '@/shared/infrastructure/auth/dataOwner';
import { analyzeCsv, type CsvAnalysis } from '@/contexts/patients/application/import-patients-flexible/analyzeCsv';
import {
  ImportPatientsWithMapping,
  type FlexibleImportResult,
} from '@/contexts/patients/application/import-patients-flexible/ImportPatientsWithMapping';
import type { ImportColumnMapping } from '@/contexts/patients/application/import-patients-flexible/importFields';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';

/**
 * Server actions del importador flexible (v3 §3): analizar el archivo para la
 * pantalla de mapeo e importar con el mapeo confirmado. El contenido viaja ya
 * decodificado (el cliente resuelve UTF-8/latin1 con decodeCsvBytes).
 */

export async function analyzeCsvAction(content: string): Promise<CsvAnalysis> {
  await requireClinicalRecordAccessUserId();
  return analyzeCsv(content);
}

export async function importWithMappingAction(
  content: string,
  mapping: ImportColumnMapping[],
): Promise<FlexibleImportResult> {
  const ownerUserId = await requireClinicalRecordAccessUserId();
  try {
    const result = await new ImportPatientsWithMapping(
      new SqlitePatientRepository(ownerUserId),
    ).import(content, mapping);
    if (result.importados > 0) revalidatePath('/pacientes');
    return result;
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'no se pudo procesar el archivo';
    return { importados: 0, errores: [{ fila: 1, motivo }], advertencias: [] };
  }
}
