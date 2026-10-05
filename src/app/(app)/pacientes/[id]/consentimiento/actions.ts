'use server';

import { revalidatePath } from 'next/cache';
import { IssuePatientConsent } from '@/contexts/clinical-records/application/issue-patient-consent/IssuePatientConsent';
import { AttachPaperConsent } from '@/contexts/clinical-records/application/attach-paper-consent/AttachPaperConsent';
import { AttachPaperConsentMessage } from '@/contexts/clinical-records/application/attach-paper-consent/AttachPaperConsentMessage';
import { RevokePatientConsent } from '@/contexts/clinical-records/application/revoke-patient-consent/RevokePatientConsent';
import { SqliteConsentTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentTemplateRepository';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { getPatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/getPatientFileStorage';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import { writeOutboxMessage } from '@/shared/infrastructure/outbox/OutboxWriter';
import { writeWhatsappOrOmit } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { wrapEmailBodyForOwner } from '@/shared/infrastructure/email-themes/wrapEmailBodyForOwner';

export interface ConsentActionState {
  ok: boolean;
  error?: string;
  /** Aviso no bloqueante (p. ej. paciente sin teléfono ni correo). */
  warning?: string;
}

function refresh(patientId: string): void {
  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath(`/pacientes/${patientId}/historia`);
  revalidatePath(`/pacientes/${patientId}/consentimiento`);
  revalidatePath('/mensajes');
}

/**
 * «Enviar consentimiento» / «Reenviar liga»: emite (o reutiliza) la liga de
 * firma y registra el mensaje en el outbox por WhatsApp (respetando el
 * presupuesto del plan) y correo.
 */
export async function sendConsentAction(patientId: string): Promise<ConsentActionState> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const issued = await new IssuePatientConsent(
      new SqlitePatientConsentRepository(ownerUserId),
      new SqliteConsentTemplateRepository(ownerUserId),
      new SqlitePatientDirectory(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
    ).execute(patientId);

    const patient = await new SqlitePatientDirectory(ownerUserId).findSummary(patientId);
    if (!patient) return { ok: false, error: 'El paciente no existe.' };

    const identity = await new SqliteProfessionalIdentityReader(ownerUserId).read();
    const practitionerName =
      identity && identity.fullName.trim() !== '' ? identity.fullName : 'tu profesional';
    const link = `${getAppBaseUrl()}/consentimiento/${issued.consent.token}`;
    const body = [
      '📝 Consentimiento informado',
      `Hola ${patient.fullName}, como parte del inicio de tu proceso de atención psicológica con *${practitionerName}*, te comparto tu consentimiento informado. Léelo con calma y fírmalo en esta liga segura:`,
      '',
      link,
      '',
      'Firmarlo toma menos de dos minutos y puedes hacerlo desde tu celular.',
      'Mensaje automatizado: no responder a este mensaje.',
    ].join('\n');
    const subject = 'Tu consentimiento informado para firma';

    let delivered = false;
    if (patient.phone.trim() !== '') {
      await writeWhatsappOrOmit({
        recipient: patient.phone,
        recipientName: patient.fullName,
        template: 'consentimiento',
        subject,
        body,
        patientId,
        ownerUserId,
      });
      delivered = true;
    }
    if (patient.email.trim() !== '') {
      await writeOutboxMessage({
        channel: 'email',
        recipient: patient.email,
        recipientName: patient.fullName,
        template: 'consentimiento',
        subject,
        body: await wrapEmailBodyForOwner(ownerUserId, body),
        patientId,
        ownerUserId,
      });
      delivered = true;
    }

    refresh(patientId);
    return delivered
      ? { ok: true }
      : {
          ok: true,
          warning:
            'La liga se generó, pero el paciente no tiene teléfono ni correo registrados: cópiala y compártesela por otro medio.',
        };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo enviar el consentimiento.',
    };
  }
}

/** Revoca la liga pendiente (el token deja de servir). */
export async function revokeConsentAction(patientId: string): Promise<ConsentActionState> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    await new RevokePatientConsent(new SqlitePatientConsentRepository(ownerUserId)).execute(patientId);
    refresh(patientId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo revocar la liga.',
    };
  }
}

/** Adjunta la foto/escaneo del consentimiento firmado en papel. */
export async function attachPaperConsentAction(
  patientId: string,
  formData: FormData,
): Promise<ConsentActionState> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  try {
    const file = formData.get('archivo');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'Selecciona la foto o el escaneo del consentimiento firmado.' };
    }
    const data = new Uint8Array(await file.arrayBuffer());
    await new AttachPaperConsent(
      new SqlitePatientConsentRepository(ownerUserId),
      new SqliteConsentTemplateRepository(ownerUserId),
      new SqlitePatientDirectory(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
      getPatientFileStorage(),
    ).execute(
      new AttachPaperConsentMessage({ patientId, filename: file.name, mime: file.type, data }),
    );
    refresh(patientId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo adjuntar el consentimiento.',
    };
  }
}
