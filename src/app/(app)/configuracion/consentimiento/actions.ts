'use server';

import { revalidatePath } from 'next/cache';
import { UpdateConsentTemplate } from '@/contexts/clinical-records/application/update-consent-template/UpdateConsentTemplate';
import { UpdateConsentTemplateMessage } from '@/contexts/clinical-records/application/update-consent-template/UpdateConsentTemplateMessage';
import { SqliteConsentTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';

export interface ConsentTemplateFormState {
  ok?: string;
  error?: string;
}

export async function updateConsentTemplateAction(
  _prev: ConsentTemplateFormState,
  formData: FormData,
): Promise<ConsentTemplateFormState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    await new UpdateConsentTemplate(new SqliteConsentTemplateRepository(ownerUserId)).execute(
      new UpdateConsentTemplateMessage({
        title: String(formData.get('titulo') ?? ''),
        body: String(formData.get('cuerpo') ?? ''),
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la plantilla.' };
  }
  revalidatePath('/configuracion/consentimiento');
  return { ok: 'Plantilla guardada. Los consentimientos que envíes a partir de ahora usarán este texto.' };
}
