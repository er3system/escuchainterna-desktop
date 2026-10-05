'use server';
import { revalidatePath } from 'next/cache';
import { requireClinicalConfigAccess, requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { ConsentReceptionSettings } from '@/contexts/clinical-records/infrastructure/consent-reception/ConsentReceptionSettings';
import { verifyConsentFolderSelection } from '@/contexts/clinical-records/infrastructure/consent-reception/nativeFolderSelection';
import { FolderConsentReceiver, assertConsentReceptionFolder } from '@/contexts/clinical-records/infrastructure/consent-reception/FolderConsentReceiver';
import { SqliteConsentInboxRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentInboxRepository';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { ConsentReceptionId } from '@/contexts/clinical-records/domain/value-objects/ConsentReceptionId';
import { ReviewReceivedConsent } from '@/contexts/clinical-records/application/review-received-consent/ReviewReceivedConsent';
import { ReviewReceivedConsentMessage } from '@/contexts/clinical-records/application/review-received-consent/ReviewReceivedConsentMessage';
async function owner(): Promise<string> { if (!isDesktopEdition()) throw new Error('La recepción por carpeta requiere la edición para PC.'); return requireClinicalConfigAccess(); }
export async function scanConsentInboxAction() { const id = await owner(); return new FolderConsentReceiver(id).receive(); }
export async function connectConsentInboxAction(proof: string) { const id = await owner(); const folder = await assertConsentReceptionFolder(verifyConsentFolderSelection(proof, id)); await new ConsentReceptionSettings(id).connect(folder); revalidatePath('/consentimientos'); }
export async function disconnectConsentInboxAction() { await new ConsentReceptionSettings(await owner()).disconnect(); revalidatePath('/consentimientos'); }
export async function saveConsentFormAction(template: string) { await new ConsentReceptionSettings(await owner()).setFormTemplate(template.trim()); revalidatePath('/consentimientos'); }
export async function dismissConsentReceiptAction(receiptId: string) {
  const id = await owner(); const db = getDatabaseAdapter(); const inbox = new SqliteConsentInboxRepository(id, db);
  await db.transaction(async () => { const receipt = await inbox.find(new ConsentReceptionId(receiptId)); if (!receipt) throw new Error('Documento no disponible.'); receipt.dismiss(); await inbox.save(receipt); }); revalidatePath('/consentimientos');
}
export async function reviewConsentReceiptAction(receiptId: string, patientId: string, date: string, confirmed: boolean) {
  await owner(); const id = await requireClinicalRecordWriteAccess(patientId); const db = getDatabaseAdapter();
  await new ReviewReceivedConsent(new SqliteConsentInboxRepository(id, db), new SqlitePatientConsentRepository(id, db), new SqlitePatientDirectory(id, db), work => db.transaction(work)).review(new ReviewReceivedConsentMessage(receiptId, patientId, date, confirmed));
  revalidatePath('/consentimientos'); revalidatePath(`/pacientes/${patientId}`); revalidatePath(`/pacientes/${patientId}/consentimiento`); revalidatePath(`/pacientes/${patientId}/historia`);
}
export async function prepareConsentReceptionAction(patientId: string) {
  await owner(); const id = await requireClinicalRecordWriteAccess(patientId); const code = await new SqliteConsentInboxRepository(id).codeForPatient(patientId); const settings = await new ConsentReceptionSettings(id).read();
  let link = '';
  if (settings?.formTemplate) { const url = new URL(settings.formTemplate); for (const [key, value] of url.searchParams) if (/^entry\.\d+$/.test(key) && value === 'CODIGO') url.searchParams.set(key, code); link = url.toString(); }
  return { code, link };
}
