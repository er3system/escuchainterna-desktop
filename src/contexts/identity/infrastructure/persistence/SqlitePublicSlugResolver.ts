import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Resuelve el dueño (owner_user_id) de un slug público de reservas:
 * primero por practitioner_profile.public_slug, después por agendas.slug.
 * Lo usa la página pública /reservar/[slug] para scoping multi-tenant.
 */
export async function resolveOwnerByPublicSlug(slug: string): Promise<string | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const db = getDatabaseAdapter();

  const profile = await db.queryRow<{ user_id: string }>(
    'SELECT user_id FROM practitioner_profile WHERE public_slug = ? LIMIT 1',
    [normalized],
  );
  if (profile) return profile.user_id;

  const agenda = await db.queryRow<{ owner_user_id: string | null }>(
    'SELECT owner_user_id FROM agendas WHERE slug = ? LIMIT 1',
    [normalized],
  );
  return agenda?.owner_user_id ?? null;
}

/**
 * Resuelve el dueño de una agenda concreta. Lo usan las server actions
 * públicas (disponibilidad de horarios) donde solo viaja el id de la agenda.
 */
export async function resolveOwnerByAgendaId(agendaId: string): Promise<string | null> {
  if (!agendaId.trim()) return null;
  const agenda = await getDatabaseAdapter().queryRow<{ owner_user_id: string | null }>(
    'SELECT owner_user_id FROM agendas WHERE id = ? LIMIT 1',
    [agendaId],
  );
  return agenda?.owner_user_id ?? null;
}
