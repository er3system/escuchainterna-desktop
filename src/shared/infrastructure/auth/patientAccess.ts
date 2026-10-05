import type { PatientSummary } from '@/contexts/clinical-records/domain/repositories/PatientDirectory';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import {
  coverageAllowed,
  effectiveAccessPolicy,
  sameConsultorio,
} from '@/contexts/identity/domain/value-objects/accessPolicy';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { isInstitutionalCustody } from './institutionalCustody';
import { resolveDataOwnerUserId, isAssistantUser } from './dataOwner';
import { activeShareForGrantee, isActiveOrgMember, memberConsultorio } from './patientShares';

export type PatientAccessMode = 'owner' | 'custody' | 'coverage' | 'share';

export interface PatientAccess {
  /**
   * 'owner'    = el actor tiene el expediente asignado (tratante real);
   * 'custody'  = lo posee como CUSTODIO institucional (§3.3), no como tratante:
   *              lectura COMPLETA permitida pero trazada como ruptura de cristal;
   * 'coverage' = acceso de cobertura, solo resumen, trazado (§2.3).
   */
  mode: PatientAccessMode;
  /**
   * Dueño con el que se deben ACOTAR las lecturas del expediente.
   *
   * ⚠️ INVARIANTE DE SEGURIDAD: para los modos de SOLO RESUMEN ('coverage' y 'share')
   * este `ownerUserId` es el del tratante real, y SOLO puede usarse para servir el
   * Resumen (lo hace page.tsx del expediente). Ninguna superficie PROFUNDA (historia,
   * sesiones, diagnóstico, archivos, export imprimible, rutas de bytes…) debe acotarse
   * por `access.ownerUserId` cuando el modo es 'coverage'/'share': esas superficies se
   * acotan al USUARIO EN SESIÓN (requireSessionUserId / requireDataOwnerUserId) y así un
   * acceso de cobertura/compartido cae a vacío por sí solo. Si una superficie profunda
   * adoptara `access.ownerUserId`, debe restringirlo antes a mode 'owner' | 'custody'.
   * (Cubierto por tests en tests/unit/security/PatientShare.spec.ts.)
   */
  ownerUserId: string;
  patient: PatientSummary;
}

/**
 * DTO mínimo para el resumen que puede recibir un assistant. La consulta del
 * repositorio comparte forma con el expediente completo; antes de cruzar la
 * frontera Server Component → Client Component se eliminan identificación y
 * contenido clínico, conservando solo contacto y estado operativo.
 */
export function patientContactSummary(patient: PatientSummary): PatientSummary {
  return {
    ...patient,
    birthDate: null,
    gender: '',
    consultationReason: '',
    therapyStartDate: null,
    notes: '',
    tags: [],
    documentType: '',
    documentNumber: '',
    guardianName: '',
    guardianRelationship: '',
    guardianDocument: '',
    currentMedication: '',
    medicalHistory: '',
    sessionFrequency: '',
    sessionModality: '',
    processStatus: '',
    treatmentEndDate: null,
    treatmentEndReason: '',
    insuranceName: '',
    insurancePolicyNumber: '',
    referralSource: '',
    customFields: [],
  };
}

/**
 * Resolutor ÚNICO de acceso a un expediente (§2.4). Decide si el actor puede verlo
 * y bajo qué dueño acotar las lecturas:
 *
 * 1. Si lo tiene ASIGNADO (es suyo / de su titular) → modo 'owner', sin traza extra.
 * 2. Si NO, y el paciente es INSTITUCIONAL de la MISMA organización y la política
 *    efectiva lo permite → modo 'coverage': lectura ampliada, acotada al tratante,
 *    y se DEJA RASTRO obligatorio 'acceso_cobertura' (habeas data, §2.3).
 * 3. En cualquier otro caso → null (el llamador hace notFound, sin revelar nada).
 *
 * La cobertura es de LECTURA. Escribir/operar sigue acotado al actor (las server
 * actions usan resolveDataOwnerUserId), así que para un expediente no asignado las
 * mutaciones fallan por sí solas: no hace falta un guard extra de escritura.
 */
export async function resolvePatientAccess(
  sessionUserId: string,
  patientId: string,
): Promise<PatientAccess | null> {
  const actorOwner = await resolveDataOwnerUserId(sessionUserId);

  // 1. ¿Asignado? (lo propio o, para un asistente, lo del titular.)
  const owned = await new SqlitePatientDirectory(actorOwner).findSummary(patientId);
  if (owned) {
    // CUSTODIA institucional (§3.3): el actor es dueño operativo pero como custodio,
    // no como tratante (el paciente quedó retenido por la institución, sin tratante).
    // La lectura clínica se permite (break-glass) pero NUNCA en silencio: se traza
    // 'acceso_cobertura' como cualquier acceso que no sea el del tratante real.
    if (await isInstitutionalCustody(patientId, actorOwner)) {
      await logRecordAccess(sessionUserId, patientId, 'resumen', 'acceso_cobertura');
      return { mode: 'custody', ownerUserId: actorOwner, patient: owned };
    }
    return { mode: 'owner', ownerUserId: actorOwner, patient: owned };
  }

  // 1.5 COMPARTIDO explícito en SOLO LECTURA (Ajustes › Compartir, migración v24): el
  // tratante le concedió a un colega de su MISMA organización lectura por paciente.
  // No cambia la propiedad. Se revalida TODO en cada lectura y se traza
  // 'acceso_compartido'. Un asistente nunca es grantee (no es miembro de la org), pero
  // se excluye de forma explícita: jamás debe ver contenido clínico por esta vía.
  if (!(await isAssistantUser(sessionUserId))) {
    const grant = await activeShareForGrantee(patientId, sessionUserId);
    if (grant) {
      // (a) Quien comparte debe SEGUIR siendo dueño: si transfirió/archivó/perdió el
      //     paciente, la concesión muere (no se puede leer como ese dueño → fuera).
      const shared = await new SqlitePatientDirectory(grant.ownerUserId).findSummary(patientId);
      // (b) Ambos —quien comparte y quien recibe— deben seguir ACTIVOS en la org del
      //     alcance. La sesión del receptor también debe estar en esa misma org.
      const context = await createIdentityUseCases().getSessionContext.get(sessionUserId);
      const sameOrganization = context?.organization?.id === grant.organizationId;
      // (c) Aislamiento de consultorio (§3): si la org usa consultorios, quien comparte
      //     y quien recibe deben estar en el MISMO (o alguno sin consultorio). Un share
      //     cross-consultorio no concede acceso aunque ambos sigan en la org.
      const consultorioOk = sameConsultorio(
        await memberConsultorio(grant.organizationId, sessionUserId),
        await memberConsultorio(grant.organizationId, grant.ownerUserId),
      );
      const granteeActive = await isActiveOrgMember(grant.organizationId, sessionUserId);
      const ownerActive = await isActiveOrgMember(grant.organizationId, grant.ownerUserId);
      if (
        shared &&
        sameOrganization &&
        consultorioOk &&
        granteeActive &&
        ownerActive
      ) {
        await logRecordAccess(sessionUserId, patientId, 'resumen', 'acceso_compartido');
        return { mode: 'share', ownerUserId: grant.ownerUserId, patient: shared };
      }
    }
  }

  // 2. Cobertura institucional. Fail-closed en cada paso.
  const ownership = await new SqlitePatientDirectory(actorOwner).findOwnership(patientId);
  if (!ownership || !ownership.organizationId) return null; // no existe o no es institucional

  const context = await createIdentityUseCases().getSessionContext.get(sessionUserId);
  if (!context || !context.organization) return null;
  const sameOrganization = context.organization.id === ownership.organizationId;
  if (!sameOrganization) return null;

  const effective = effectiveAccessPolicy({
    orgPolicy: context.organization.accessPolicy,
    professorCanWiden: context.organization.professorCanWiden,
    professorOverride: null, // ajuste del profesor: diferido (H5a deja la base lista)
  });
  const actorSupervisesTratante = await new SqliteSupervisorReader().supervises(
    sessionUserId,
    ownership.ownerUserId,
    context.organization.id,
  );
  // Aislamiento de consultorio (§3): el consultorio del paciente = el de su tratante
  // (un consultorio por miembro). Distinto consultorio dentro de la misma org ⇒ negado.
  const consultorioMatches = sameConsultorio(
    await memberConsultorio(context.organization.id, sessionUserId),
    await memberConsultorio(ownership.organizationId, ownership.ownerUserId),
  );
  if (
    !coverageAllowed({
      effectivePolicy: effective,
      sameOrganization,
      sameConsultorio: consultorioMatches,
      actorSupervisesTratante,
    })
  ) {
    return null;
  }

  // Cobertura concedida: traza OBLIGATORIA y lectura acotada al tratante real.
  const patient = await new SqlitePatientDirectory(ownership.ownerUserId).findSummary(patientId);
  if (!patient) return null; // por seguridad: si no se puede leer como el tratante, fuera
  await logRecordAccess(sessionUserId, patientId, 'resumen', 'acceso_cobertura');
  return { mode: 'coverage', ownerUserId: ownership.ownerUserId, patient };
}
