'use server';

import { revalidatePath } from 'next/cache';
import { SearchCie11, type Cie11SearchResult } from '@/contexts/clinical-records/application/search-cie11/SearchCie11';
import type { Cie11Entry } from '@/contexts/clinical-records/domain/repositories/Cie11Catalog';
import { SqliteCie11Catalog } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCie11Catalog';
import { RegisterDiagnosis } from '@/contexts/clinical-records/application/register-diagnosis/RegisterDiagnosis';
import { RegisterDiagnosisMessage } from '@/contexts/clinical-records/application/register-diagnosis/RegisterDiagnosisMessage';
import { UpdateDiagnosisStatus } from '@/contexts/clinical-records/application/update-diagnosis-status/UpdateDiagnosisStatus';
import { SetDiagnosisFormality } from '@/contexts/clinical-records/application/set-diagnosis-formality/SetDiagnosisFormality';
import type { DiagnosisKind } from '@/contexts/clinical-records/domain/Diagnosis';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import {
  requireActiveAppSessionUserId,
  requireClinicalRecordWriteAccess,
} from '@/shared/infrastructure/auth/dataOwner';

export async function searchCie11Action(text: string): Promise<Cie11SearchResult> {
  await requireActiveAppSessionUserId(); // catálogo público, pero solo con acceso privado vigente
  return await new SearchCie11(new SqliteCie11Catalog()).search(text, 30);
}

export async function childrenOfAction(parentCode: string | null, chapter: string): Promise<Cie11Entry[]> {
  await requireActiveAppSessionUserId();
  return await new SearchCie11(new SqliteCie11Catalog()).childrenOf(parentCode, chapter);
}

export async function registerDiagnosisAction(
  patientId: string,
  cie11Code: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new RegisterDiagnosis(new SqliteDiagnosisRepository(ownerUserId), new SqliteCie11Catalog());
    await useCase.execute(
      new RegisterDiagnosisMessage({ patientId, cie11Code, notes, registeredByUserId: ownerUserId }),
    );
    revalidatePath(`/pacientes/${patientId}/diagnostico`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo registrar el diagnóstico.' };
  }
}

export async function setDiagnosisFormalityAction(
  diagnosisId: string,
  patientId: string,
  kind: DiagnosisKind,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const useCase = new SetDiagnosisFormality(
      new SqliteDiagnosisRepository(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
    );
    await useCase.execute({ diagnosisId, patientId, kind, actorUserId: ownerUserId });
    revalidatePath(`/pacientes/${patientId}/diagnostico`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo cambiar la naturaleza del diagnóstico.',
    };
  }
}

export async function updateDiagnosisStatusAction(
  diagnosisId: string,
  patientId: string,
  status: string,
): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const useCase = new UpdateDiagnosisStatus(new SqliteDiagnosisRepository(ownerUserId));
  await useCase.execute(diagnosisId, patientId, status);
  revalidatePath(`/pacientes/${patientId}/diagnostico`);
}
