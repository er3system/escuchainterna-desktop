'use server';

import { revalidatePath } from 'next/cache';
import { UploadPatientFile } from '@/contexts/clinical-records/application/upload-patient-file/UploadPatientFile';
import { UploadPatientFileMessage } from '@/contexts/clinical-records/application/upload-patient-file/UploadPatientFileMessage';
import { DeletePatientFile } from '@/contexts/clinical-records/application/delete-patient-file/DeletePatientFile';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { getPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/getPatientFileStorage';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import {
  BYTES_PER_GB,
  getStorageUsage,
  wouldExceedQuota,
} from '@/shared/infrastructure/storage-billing/StorageQuotaGate';

export async function uploadFilesAction(
  patientId: string,
  formData: FormData,
): Promise<{ ok: boolean; uploaded: number; errors: string[] }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const entries = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
  const useCase = new UploadPatientFile(
    new SqlitePatientFileRepository(ownerUserId),
    getPatientFileStorage(),
  );
  // Cuota de almacenamiento por dueño (acumulada). El tope por archivo (20 MB)
  // lo aplica el propio UploadPatientFileMessage.
  const { usedBytes, limitBytes } = await getStorageUsage(ownerUserId);
  let runningBytes = usedBytes;

  const errors: string[] = [];
  let uploaded = 0;
  for (const file of entries) {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      if (wouldExceedQuota(runningBytes, data.byteLength, limitBytes)) {
        const limitGb = (limitBytes ?? 0) / BYTES_PER_GB;
        errors.push(
          `"${file.name}" supera tu cuota de almacenamiento (${limitGb} GB). Libera espacio o mejora tu plan.`,
        );
        continue;
      }
      await useCase.execute(
        new UploadPatientFileMessage({ patientId, filename: file.name, mime: file.type, data }),
      );
      runningBytes += data.byteLength;
      uploaded += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `No se pudo subir "${file.name}".`);
    }
  }
  revalidatePath(`/pacientes/${patientId}/archivos`);
  return { ok: errors.length === 0, uploaded, errors };
}

export async function deleteFileAction(patientId: string, fileId: string): Promise<void> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const useCase = new DeletePatientFile(
    new SqlitePatientFileRepository(ownerUserId),
    getPatientFileStorage(),
  );
  await useCase.execute(fileId, patientId);
  revalidatePath(`/pacientes/${patientId}/archivos`);
}
