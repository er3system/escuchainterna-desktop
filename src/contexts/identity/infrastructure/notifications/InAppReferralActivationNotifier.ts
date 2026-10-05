import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  ReferralActivationNotice,
  ReferralActivationNotifier,
} from '../../domain/ReferralActivationNotifier';

/**
 * Adaptador local del aviso al referente (v3 §11): escribe una notificación
 * in-app (campana) directamente en la tabla `notifications` del contexto de
 * notificaciones — sin red, visible de inmediato.
 */
export class InAppReferralActivationNotifier implements ReferralActivationNotifier {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async notifyReferralActivated(notice: ReferralActivationNotice): Promise<void> {
    await this.db.execute(
      `INSERT INTO notifications (id, recipient_user_id, kind, title, body, link, created_at)
         VALUES (?, ?, 'novedad', ?, ?, '/configuracion/suscripcion', ?)`,
      [
        randomUUID(),
        notice.referrerUserId,
        '¡Tu referido activó su suscripción!',
        `${notice.referredDisplayName} realizó su primer pago. Tu descuento del programa de referidos ya es del ${notice.discountPercent}% para tu próximo cobro.`,
        new Date().toISOString(),
      ],
    );
  }
}
