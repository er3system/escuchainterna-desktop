'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { StartClinicalRecord } from '@/contexts/clinical-records/application/start-clinical-record/StartClinicalRecord';
import { StartClinicalRecordMessage } from '@/contexts/clinical-records/application/start-clinical-record/StartClinicalRecordMessage';
import { SaveClinicalRecordAnswers } from '@/contexts/clinical-records/application/save-clinical-record-answers/SaveClinicalRecordAnswers';
import { SaveClinicalRecordAnswersMessage } from '@/contexts/clinical-records/application/save-clinical-record-answers/SaveClinicalRecordAnswersMessage';
import { DeleteClinicalRecord } from '@/contexts/clinical-records/application/delete-clinical-record/DeleteClinicalRecord';
import { DemotePrimaryHistory } from '@/contexts/clinical-records/application/demote-primary-history/DemotePrimaryHistory';
import { OpenNewExpediente, type SealScope } from '@/contexts/clinical-records/application/open-new-expediente/OpenNewExpediente';
import { AddHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/AddHistoriaBlock';
import { RemoveHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/RemoveHistoriaBlock';
import { EnsurePrimaryHistory } from '@/contexts/clinical-records/application/historia-clinica/EnsurePrimaryHistory';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { SqliteRecordSuggestionRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRecordSuggestionRepository';
import { SqliteUserPreferencesRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteUserPreferencesRepository';
import {
  HISTORIA_DEFAULT_TEMPLATE_KEY,
  normalizeDefaultTemplateId,
} from '@/contexts/clinical-records/domain/clinicalPreferences';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export async function startRecordAction(patientId: string, templateId: string | null): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const useCase = new StartClinicalRecord(
    new SqliteClinicalRecordRepository(ownerUserId),
    new SqliteClinicalTemplateRepository(ownerUserId),
  );
  const recordId = await useCase.execute(new StartClinicalRecordMessage({ patientId, templateId }));
  revalidatePath(`/pacientes/${patientId}/historia`);
  redirect(`/pacientes/${patientId}/historia/${recordId}`);
}

/**
 * Inicia la historia clínica PRIMARIA del paciente eligiendo una plantilla-modelo
 * que aporta su núcleo (§1). Idempotente: si ya existe una historia primaria, no
 * crea otra. Tras crearla, lleva al Documento del expediente.
 */
export async function startPrimaryHistoryAction(
  patientId: string,
  templateId: string | null,
): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new EnsurePrimaryHistory(
    new SqliteClinicalRecordRepository(ownerUserId),
    new SqliteClinicalTemplateRepository(ownerUserId),
  ).ensure(patientId, templateId);
  revalidatePath(`/pacientes/${patientId}/historia`);
  redirect(`/pacientes/${patientId}/historia?vista=documento`);
}

/**
 * Abre un NUEVO EPISODIO que coexiste: fuerza la creación de otra historia primaria
 * aunque ya haya una abierta (no la sella). La recién creada pasa a ser la vigente;
 * la anterior queda abierta y editable como "otro expediente abierto".
 */
export async function startNewEpisodeAction(
  patientId: string,
  templateId: string | null,
): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new EnsurePrimaryHistory(
    new SqliteClinicalRecordRepository(ownerUserId),
    new SqliteClinicalTemplateRepository(ownerUserId),
  ).ensure(patientId, templateId, true);
  revalidatePath(`/pacientes/${patientId}/historia`);
  redirect(`/pacientes/${patientId}/historia?vista=documento`);
}

export async function saveRecordAnswersAction(
  recordId: string,
  patientId: string,
  answers: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new SaveClinicalRecordAnswers(new SqliteClinicalRecordRepository(ownerUserId));
    await useCase.execute(new SaveClinicalRecordAnswersMessage({ recordId, patientId, answers }));
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar.' };
  }
}

/**
 * Añade un bloque del catálogo (una sección de plantilla integrada) a la
 * historia clínica consolidada del paciente. Verifica la pertenencia del
 * registro al paciente antes de tocarlo (defensa además del scope por dueño).
 */
export async function addHistoriaBlockAction(
  recordId: string,
  patientId: string,
  blockId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    // La pertenencia (belongsTo) y la inmutabilidad del sellado las hace cumplir el caso de uso.
    await new AddHistoriaBlock(new SqliteClinicalRecordRepository(ownerUserId)).add(recordId, patientId, blockId);
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo añadir el bloque.' };
  }
}

/** Quita un bloque añadido de la historia consolidada (el núcleo no se puede quitar). */
export async function removeHistoriaBlockAction(
  recordId: string,
  patientId: string,
  sectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new RemoveHistoriaBlock(new SqliteClinicalRecordRepository(ownerUserId)).remove(recordId, patientId, sectionId);
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo quitar el bloque.' };
  }
}

/**
 * Marca (o desmarca con `templateId = null`) la plantilla-modelo por defecto del
 * profesional al iniciar una historia clínica (preferencia por usuario, §3).
 * Valida que la plantilla exista y sea usable por el dueño antes de persistirla.
 */
export async function setDefaultHistoriaTemplateAction(
  patientId: string,
  templateId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const prefs = new SqliteUserPreferencesRepository(ownerUserId);
    const normalized = normalizeDefaultTemplateId(templateId);
    if (normalized === null) {
      await prefs.delete(HISTORIA_DEFAULT_TEMPLATE_KEY);
    } else {
      const template = await new SqliteClinicalTemplateRepository(ownerUserId).findById(normalized);
      if (!template) return { ok: false, error: 'Plantilla no encontrada.' };
      await prefs.set(HISTORIA_DEFAULT_TEMPLATE_KEY, normalized);
    }
    revalidatePath(`/pacientes/${patientId}/historia/nueva`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la preferencia.' };
  }
}

/**
 * Cambiar de formato (§P3): degrada la historia primaria a registro aparte (conserva
 * el contenido) y lleva al selector de modelo para iniciar una nueva primaria.
 */
export async function changeHistoryModelAction(recordId: string, patientId: string): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  await new DemotePrimaryHistory(new SqliteClinicalRecordRepository(ownerUserId)).execute(recordId, patientId);
  revalidatePath(`/pacientes/${patientId}/historia`);
  redirect(`/pacientes/${patientId}/historia/nueva?primaria=1`);
}

/**
 * Abrir expediente nuevo según el motivo:
 * - 'episodio-coexiste' → no sella; el anterior queda abierto. El selector fuerza
 *   crear otra primaria (?coexiste=1 → startNewEpisodeAction).
 * - 'episodio-sella'    → sella el expediente vigente y abre uno nuevo.
 * - 'relevo'            → sella TODOS los expedientes abiertos y abre uno nuevo.
 * En los dos últimos, tras sellar no hay primaria abierta, así que el selector crea
 * la nueva con EnsurePrimaryHistory normal.
 */
export async function openNewExpedienteAction(
  patientId: string,
  mode: 'episodio-coexiste' | 'episodio-sella' | 'relevo',
  label: string,
): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const sealScope: SealScope =
    mode === 'relevo' ? 'all' : mode === 'episodio-sella' ? 'current' : 'none';
  await new OpenNewExpediente(new SqliteClinicalRecordRepository(ownerUserId)).execute(patientId, {
    sealScope,
    label,
  });
  revalidatePath(`/pacientes/${patientId}/historia`);
  const coexiste = mode === 'episodio-coexiste' ? '&coexiste=1' : '';
  redirect(`/pacientes/${patientId}/historia/nueva?primaria=1${coexiste}`);
}

export async function deleteRecordAction(
  recordId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new DeleteClinicalRecord(
      new SqliteClinicalRecordRepository(ownerUserId),
      new SqliteRecordSuggestionRepository(ownerUserId),
    );
    // Atómico: borra las sugerencias de IA + la historia juntas (o nada).
    await getDatabaseAdapter().transaction(() => useCase.execute(recordId, patientId));
    revalidatePath(`/pacientes/${patientId}/historia`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar la historia.' };
  }
}
