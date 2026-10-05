import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Sella la sede (consultorio) de unas reservas recién creadas (Modo Sedes, MS3). Validación
 * defensiva: la sede debe pertenecer a la organización del DUEÑO de las citas y esa org debe
 * estar en modo 'compartido' (en 'aislado' la sede por sesión no aplica). Si la sede no es
 * válida para ese dueño/modo, NO se sella (silencioso): el selector solo ofrece sedes válidas.
 * Pensado para llamarse DENTRO de la misma transacción que crea las reservas.
 */
export async function stampBookingsConsultorio(
  ownerUserId: string,
  bookingIds: string[],
  consultorioId: string,
): Promise<void> {
  const id = consultorioId.trim();
  if (!id || bookingIds.length === 0) return;
  const db = getDatabaseAdapter();
  const valid = await db.queryRow(
    `SELECT 1 FROM consultorios c
         JOIN organization_memberships m ON m.organization_id = c.organization_id AND m.user_id = ?
         JOIN organizations o ON o.id = c.organization_id
        WHERE c.id = ? AND c.archived = 0 AND o.consultorio_mode = 'compartido' LIMIT 1`,
    [ownerUserId, id],
  );
  if (!valid) return;
  for (const bookingId of bookingIds) {
    await db.execute('UPDATE bookings SET consultorio_id = ? WHERE id = ? AND owner_user_id = ?', [
      id,
      bookingId,
      ownerUserId,
    ]);
  }
}
