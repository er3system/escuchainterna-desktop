import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { memberConsultorio } from '@/shared/infrastructure/auth/patientShares';

/**
 * Lecturas para la sección "Compartir" del Ajustes del paciente. Solo el dueño llega
 * aquí (la página está acotada al tratante), así que estas consultas son del lado del
 * dueño: ¿en qué organización estoy? ¿con qué colegas puedo compartir?
 */

/** La organización ACTIVA del usuario en sesión, o null si es independiente. */
export async function ownerOrganizationId(userId: string): Promise<string | null> {
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  return context?.organization?.id ?? null;
}

export interface ShareableColleague {
  userId: string;
  name: string;
  email: string;
  role: 'master' | 'professor' | 'psychologist';
}

/**
 * Colegas con los que se puede compartir: miembros ACTIVOS de la misma organización,
 * excluyendo a uno mismo. (Los asistentes no aparecen: no son miembros de la org.)
 */
export async function listShareableColleagues(
  organizationId: string,
  excludeUserId: string,
): Promise<ShareableColleague[]> {
  // Aislamiento de consultorio (§3): solo colegas del MISMO consultorio que el dueño
  // (o cualquiera si el dueño o el colega no tienen consultorio: org plana / master).
  const ownerConsultorio = await memberConsultorio(organizationId, excludeUserId);
  const rows = (await getDatabaseAdapter().query(
    `SELECT m.user_id, m.member_role,
              u.email,
              COALESCE(NULLIF(p.full_name, ''), u.email) AS name
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN practitioner_profile p ON p.user_id = m.user_id
        WHERE m.organization_id = ? AND m.user_id != ? AND u.status = 'activo'
          AND (? IS NULL OR m.consultorio_id IS NULL OR m.consultorio_id = ?)
        ORDER BY LOWER(name) ASC`,
    [organizationId, excludeUserId, ownerConsultorio, ownerConsultorio],
  )) as unknown as Array<{
    user_id: string;
    member_role: string;
    email: string;
    name: string;
  }>;
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: (['master', 'professor', 'psychologist'].includes(row.member_role)
      ? row.member_role
      : 'psychologist') as ShareableColleague['role'],
  }));
}
