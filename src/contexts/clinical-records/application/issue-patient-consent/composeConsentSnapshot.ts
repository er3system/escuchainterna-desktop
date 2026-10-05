import { randomUUID } from 'node:crypto';
import { isMinor } from '@/contexts/patients/domain/value-objects/minor';
import { ConsentTemplate } from '../../domain/ConsentTemplate';
import { resolveConsentVariables } from '../../domain/value-objects/defaultConsentBody';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import { ConsentNotFoundError } from '../../domain/errors/ConsentNotFoundError';

/**
 * Encabezado que se antepone al cuerpo del consentimiento cuando el paciente es
 * MENOR de edad y tiene un representante legal (acudiente) registrado: deja
 * constancia de que quien otorga el consentimiento es el representante, en nombre
 * del menor (Ley 1581 / Código Civil colombiano: los menores actúan por medio de
 * su representante legal). Solo se añade en ese caso; el flujo adulto no cambia.
 */
export function minorConsentPreamble(
  patientName: string,
  guardianName: string,
  guardianRelationship: string,
): string {
  const trimmedName = guardianName.trim();
  const who = trimmedName !== '' ? trimmedName : 'el/la representante legal';
  const rel = guardianRelationship.trim();
  const relPart = rel !== '' ? ` (${rel})` : '';
  return (
    `AVISO PARA PACIENTE MENOR DE EDAD: este consentimiento lo otorga ${who}${relPart}, ` +
    `en calidad de representante legal (acudiente) de ${patientName}, persona menor de edad, ` +
    `y autoriza en su nombre la atención psicológica descrita a continuación.`
  );
}

export interface ConsentSnapshot {
  title: string;
  /** Cuerpo con {{paciente}}/{{profesional}}/{{cedula}} congelados; {{fecha}} se resuelve al mostrar/firmar. */
  body: string;
  patientName: string;
}

/**
 * Congela el snapshot del consentimiento al emitirlo (v3 §2): plantilla del
 * profesional (creada con el texto base si aún no existe) + variables del
 * paciente y del profesional resueltas. {{fecha}} queda viva para resolverse
 * con la fecha de firma al mostrar el documento.
 */
export async function composeConsentSnapshot(
  templates: ConsentTemplateRepository,
  patients: PatientDirectory,
  professional: ProfessionalIdentityReader,
  patientId: string,
): Promise<ConsentSnapshot> {
  const patient = await patients.findSummary(patientId);
  if (!patient) throw new ConsentNotFoundError();

  let template = await templates.find();
  if (!template) {
    template = ConsentTemplate.createDefault(randomUUID());
    await templates.save(template);
  }
  const templatePrimitives = template.toPrimitives();
  const identity = await professional.read();

  const resolvedBody = resolveConsentVariables(templatePrimitives.body, {
    paciente: patient.fullName,
    profesional: identity && identity.fullName.trim() !== '' ? identity.fullName : 'el/la profesional tratante',
    cedula:
      identity && identity.professionalLicense.trim() !== ''
        ? identity.professionalLicense
        : 'sin registro capturado',
  });

  // Paciente menor de edad CON representante legal: el consentimiento lo otorga el
  // representante en su nombre. Se antepone el aviso al cuerpo congelado; sin
  // representante (o adulto) el comportamiento es el de siempre.
  const minorWithGuardian = isMinor(patient.birthDate) && patient.guardianName.trim() !== '';
  const body = minorWithGuardian
    ? `${minorConsentPreamble(patient.fullName, patient.guardianName, patient.guardianRelationship)}\n\n${resolvedBody}`
    : resolvedBody;

  return { title: templatePrimitives.title, body, patientName: patient.fullName };
}
