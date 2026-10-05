import type { BookingRepository } from '../../domain/repositories/BookingRepository';
import type { SendSessionReminder } from '../send-session-reminder/SendSessionReminder';

/** Dice si una reserva YA tiene un recordatorio de sesión emitido (dedupe, vía outbox). */
export type AlreadyRemindedChecker = (bookingId: string) => Promise<boolean>;

/**
 * Scheduler de recordatorios de sesión (re-plataforma 0f.2). Busca las reservas
 * activas que INICIAN dentro de la ventana de aviso del profesional
 * (`session_reminder_hours`, p. ej. 24 h) y aún no tienen recordatorio emitido, y
 * envía el aviso de cada una. Idempotente: el dedupe se hace contra el outbox
 * (no se reenvía aunque el job corra cada hora). Lo dispara `/api/jobs/run`.
 *
 * Cierra el "hueco del job-runner": hasta ahora el recordatorio de sesión solo
 * salía con el botón 🔔 manual; nada lo disparaba antes de la cita.
 */
export class SendDueSessionReminders {
  public constructor(
    private readonly bookings: BookingRepository,
    private readonly sender: SendSessionReminder,
    private readonly reminderHours: number,
    private readonly alreadyReminded: AlreadyRemindedChecker,
  ) {}

  public async run(now: Date = new Date()): Promise<{ due: number; sent: number }> {
    const hours = this.reminderHours > 0 ? this.reminderHours : 24;
    const until = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const nowIso = now.toISOString();

    // findActiveBetween devuelve las que SOLAPAN [now, until]; nos quedamos con las que
    // INICIAN en la ventana (las ya empezadas no reciben recordatorio).
    const candidates = (await this.bookings.findActiveBetween(now, until)).filter(
      (booking) => booking.toPrimitives().startAt >= nowIso,
    );

    let sent = 0;
    for (const booking of candidates) {
      const id = booking.toPrimitives().id;
      if (!booking.canReceiveReminder()) continue;
      if (await this.alreadyReminded(id)) continue;
      try {
        await this.sender.send(id);
        sent += 1;
      } catch {
        // El fallo de una reserva no debe detener las demás (el job es best-effort).
      }
    }
    return { due: candidates.length, sent };
  }
}
