import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * v3 §3 (universidades — servicio sin costo): ¿el dueño de los datos pertenece
 * a una organización con `free_service` activo? Lo consultan las rutas
 * públicas (/reservar, /sesion) — donde el dueño se resuelve por slug o por
 * reserva, sin sesión — y el onboarding, para ocultar precios/pagos y saltar
 * el paso de pago.
 */
export async function ownerHasFreeService(ownerUserId: string): Promise<boolean> {
  if (!ownerUserId.trim()) return false;
  const row = await getDatabaseAdapter().queryRow<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM organization_memberships m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? AND o.free_service = 1`,
    [ownerUserId],
  );
  return (row?.n ?? 0) > 0;
}
