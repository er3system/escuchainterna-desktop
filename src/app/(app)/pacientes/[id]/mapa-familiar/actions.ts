'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CreateFamilyMap } from '@/contexts/clinical-records/application/create-family-map/CreateFamilyMap';
import { SaveFamilyMap } from '@/contexts/clinical-records/application/save-family-map/SaveFamilyMap';
import { SaveFamilyMapMessage } from '@/contexts/clinical-records/application/save-family-map/SaveFamilyMapMessage';
import { DeleteFamilyMap } from '@/contexts/clinical-records/application/delete-family-map/DeleteFamilyMap';
import { SqliteFamilyMapRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteFamilyMapRepository';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';

export async function createFamilyMapAction(patientId: string, formData: FormData): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const title = String(formData.get('title') ?? '');
  const useCase = new CreateFamilyMap(new SqliteFamilyMapRepository(ownerUserId));
  const mapId = await useCase.execute(patientId, title);
  revalidatePath(`/pacientes/${patientId}/mapa-familiar`);
  redirect(`/pacientes/${patientId}/mapa-familiar/${mapId}`);
}

export async function saveFamilyMapAction(
  mapId: string,
  patientId: string,
  title: string,
  data: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new SaveFamilyMap(new SqliteFamilyMapRepository(ownerUserId));
    await useCase.execute(new SaveFamilyMapMessage({ mapId, patientId, title, data }));
    revalidatePath(`/pacientes/${patientId}/mapa-familiar`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar el mapa.' };
  }
}

export async function deleteFamilyMapAction(
  mapId: string,
  patientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new DeleteFamilyMap(new SqliteFamilyMapRepository(ownerUserId));
    await useCase.execute(mapId, patientId);
    revalidatePath(`/pacientes/${patientId}/mapa-familiar`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el mapa.' };
  }
}
