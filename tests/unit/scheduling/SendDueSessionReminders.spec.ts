import { describe, it, expect } from 'vitest';
import { SendDueSessionReminders } from '@/contexts/scheduling/application/send-due-session-reminders/SendDueSessionReminders';
import type { BookingRepository } from '@/contexts/scheduling/domain/repositories/BookingRepository';
import type { SendSessionReminder } from '@/contexts/scheduling/application/send-session-reminder/SendSessionReminder';
import type { Booking } from '@/contexts/scheduling/domain/Booking';

/** Scheduler de recordatorios de sesión (re-plataforma 0f.2). */

const NOW = new Date('2026-06-23T10:00:00.000Z');

function fakeBooking(id: string, startAt: string, canRemind: boolean): Booking {
  return {
    toPrimitives: () => ({ id, startAt }),
    canReceiveReminder: () => canRemind,
  } as unknown as Booking;
}

function repoReturning(bookings: Booking[]): BookingRepository {
  return {
    // Imita al repo: solo las que inician antes del fin de la ventana.
    findActiveBetween: async (_from: Date, to: Date) =>
      bookings.filter((b) => b.toPrimitives().startAt < to.toISOString()),
  } as unknown as BookingRepository;
}

describe('SendDueSessionReminders', () => {
  const inWindow = new Date(NOW.getTime() + 12 * 3_600_000).toISOString(); // 12 h (dentro de 24 h)
  const started = new Date(NOW.getTime() - 3_600_000).toISOString(); // ya empezó

  it('envía solo a las citas en ventana, que pueden recibir aviso y aún no avisadas', async () => {
    const repo = repoReturning([
      fakeBooking('b1', inWindow, true), // ✓ debe enviarse
      fakeBooking('b2', inWindow, false), // estado no apto → skip
      fakeBooking('b3', inWindow, true), // ya avisada → skip
      fakeBooking('b4', started, true), // ya empezó → filtrada por startAt >= now
    ]);
    const sent: string[] = [];
    const sender = { send: async (id: string) => void sent.push(id) } as unknown as SendSessionReminder;
    const alreadyReminded = async (id: string) => id === 'b3';

    const result = await new SendDueSessionReminders(repo, sender, 24, alreadyReminded).run(NOW);

    expect(sent).toEqual(['b1']);
    expect(result.sent).toBe(1);
  });

  it('el fallo de una cita no detiene las demás (best-effort)', async () => {
    const repo = repoReturning([
      fakeBooking('boom', inWindow, true),
      fakeBooking('ok', inWindow, true),
    ]);
    const sent: string[] = [];
    const sender = {
      send: async (id: string) => {
        if (id === 'boom') throw new Error('falló el envío');
        sent.push(id);
      },
    } as unknown as SendSessionReminder;

    const result = await new SendDueSessionReminders(repo, sender, 24, async () => false).run(NOW);

    expect(sent).toEqual(['ok']);
    expect(result.sent).toBe(1);
  });

  it('reminderHours inválido (0) cae al default de 24 h', async () => {
    const repo = repoReturning([fakeBooking('b1', inWindow, true)]);
    const sent: string[] = [];
    const sender = { send: async (id: string) => void sent.push(id) } as unknown as SendSessionReminder;
    await new SendDueSessionReminders(repo, sender, 0, async () => false).run(NOW);
    expect(sent).toEqual(['b1']); // 12h cae dentro del default de 24h
  });
});
