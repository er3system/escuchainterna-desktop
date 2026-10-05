import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { resolveDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { isInstitutionalCustody } from '@/shared/infrastructure/auth/institutionalCustody';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import {
  isExpedientePathForbiddenForAssistant,
  logRecordAccess,
  parseExpedientePath,
} from '@/shared/infrastructure/audit/recordAccessLog';

/**
 * Guard del expediente clínico (v3 §1.2 y §4):
 *
 * 1. Bitácora: registra el acceso por área (la ruta viene del header
 *    `x-pathname` que pone el middleware), con throttle de 10 minutos.
 * 2. Bloqueo del rol `assistant`: un asistente/recepcionista solo ve datos de
 *    contacto y pagos; cualquier área clínica (historia, sesiones, diagnóstico,
 *    archivos, exportar, mapa familiar) lo regresa a /pacientes con aviso.
 *
 * Se llama desde `layout.tsx` (primera carga del expediente) y desde
 * `template.tsx` (cada navegación entre pestañas, porque el layout de Next no
 * se vuelve a renderizar en navegación suave). El throttle hace inocua la
 * doble llamada.
 */
export async function auditExpedienteAccess(fallbackPatientId?: string): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const pathname = (await headers()).get('x-pathname') ?? '';
  const parsed = parseExpedientePath(pathname);

  const row = await getDatabaseAdapter().queryRow<{ role?: string }>(
    'SELECT role FROM users WHERE id = ?',
    [userId],
  );

  if (row?.role === 'assistant') {
    // Falla cerrado: si no podemos determinar el área o es área clínica, fuera.
    if (isExpedientePathForbiddenForAssistant(pathname)) redirect('/pacientes?aviso=expediente');
  }

  const patientId = parsed?.patientId ?? fallbackPatientId;
  if (patientId) {
    // Se traza 'ver' del acceso PROPIO (el paciente es del actor o de su titular).
    // Un acceso de cobertura (§2.4) ya queda registrado como 'acceso_cobertura' por
    // el resolutor y NO llega aquí. Pero la CUSTODIA institucional (§3.3) SÍ pasa por
    // aquí (el custodio es dueño operativo): cada área se traza como ruptura de
    // cristal 'acceso_cobertura', nunca como un 'ver' que disfrace su naturaleza.
    const ownerUserId = await resolveDataOwnerUserId(userId);
    const owned = (await new SqlitePatientDirectory(ownerUserId).findSummary(patientId)) !== null;
    if (owned) {
      const custody = await isInstitutionalCustody(patientId, ownerUserId);
      await logRecordAccess(userId, patientId, parsed?.area ?? 'resumen', custody ? 'acceso_cobertura' : 'ver');
    }
  }
}
