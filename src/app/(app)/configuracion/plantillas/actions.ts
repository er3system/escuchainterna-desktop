'use server';

import { revalidatePath } from 'next/cache';
import { CreateCustomTemplate } from '@/contexts/clinical-records/application/create-custom-template/CreateCustomTemplate';
import { CreateCustomTemplateMessage } from '@/contexts/clinical-records/application/create-custom-template/CreateCustomTemplateMessage';
import { UpdateCustomTemplate } from '@/contexts/clinical-records/application/update-custom-template/UpdateCustomTemplate';
import { UpdateCustomTemplateMessage } from '@/contexts/clinical-records/application/update-custom-template/UpdateCustomTemplateMessage';
import { DeleteCustomTemplate } from '@/contexts/clinical-records/application/delete-custom-template/DeleteCustomTemplate';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';

export interface TemplateActionInput {
  name: string;
  therapyType: string;
  description: string;
  sections: unknown;
}

export type TemplateActionResult = { ok: true } | { ok: false; error: string };

export async function createTemplateAction(input: TemplateActionInput): Promise<TemplateActionResult> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const useCase = new CreateCustomTemplate(new SqliteClinicalTemplateRepository(ownerUserId));
    await useCase.execute(new CreateCustomTemplateMessage(input));
    revalidatePath('/configuracion/plantillas');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear la plantilla.' };
  }
}

export async function updateTemplateAction(
  templateId: string,
  input: TemplateActionInput,
): Promise<TemplateActionResult> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const useCase = new UpdateCustomTemplate(new SqliteClinicalTemplateRepository(ownerUserId));
    await useCase.execute(new UpdateCustomTemplateMessage({ templateId, ...input }));
    revalidatePath('/configuracion/plantillas');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar la plantilla.' };
  }
}

export async function deleteTemplateAction(templateId: string): Promise<TemplateActionResult> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const useCase = new DeleteCustomTemplate(new SqliteClinicalTemplateRepository(ownerUserId));
    await useCase.execute(templateId);
    revalidatePath('/configuracion/plantillas');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar la plantilla.' };
  }
}
