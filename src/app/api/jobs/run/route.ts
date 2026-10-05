import type { NextRequest } from 'next/server';
import { processOutbox } from '@/shared/infrastructure/outbox/processOutbox';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { RunDueAutomations } from '@/contexts/marketing/application/run-due-automations/RunDueAutomations';
import { OutboxEmailDispatcher } from '@/contexts/marketing/infrastructure/outbox/OutboxEmailDispatcher';
import { SqliteAutomationDeliveryLog } from '@/contexts/marketing/infrastructure/persistence/SqliteAutomationDeliveryLog';
import { SqliteMarketingAutomationRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository';
import { SqliteMessageTemplateOverrideRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMessageTemplateOverrideRepository';
import { SqliteRecipientDirectory } from '@/contexts/marketing/infrastructure/persistence/SqliteRecipientDirectory';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { SqliteBookingRepository } from '@/contexts/scheduling/infrastructure/persistence/SqliteBookingRepository';
import { SendDueSessionReminders } from '@/contexts/scheduling/application/send-due-session-reminders/SendDueSessionReminders';
import { ownerHasActiveAppAccess } from '@/shared/infrastructure/auth/dataOwner';

/**
 * Disparador de JOBS programados (re-plataforma 0f). Lo invoca un scheduler
 * EXTERNO (Cloudflare Cron, GitHub Action, un worker…) por HTTP; así funciona
 * 12-factor y multi-instancia (una petición la atiende una instancia). Protegido
 * por `JOBS_SECRET` (Bearer). Sin esa variable el endpoint está deshabilitado.
 *
 * Hace tres cosas idempotentes:
 *  1) Drena el OUTBOX durable (reintentos de correo con backoff) — processOutbox.
 *  2) Envía los RECORDATORIOS DE SESIÓN de las citas próximas (dentro de la
 *     ventana de aviso de cada profesional) que aún no se han avisado.
 *  3) Corre las AUTOMATIZACIONES de marketing vencidas (cumpleaños, reactivación).
 * (2) y (3) cierran el "hueco del job-runner": antes los recordatorios de sesión
 * eran solo manuales (🔔) y las automatizaciones solo corrían al visitar /marketing.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.JOBS_SECRET;
  if (!secret) {
    return new Response('Jobs deshabilitados: falta JOBS_SECRET.', { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const outbox = await processOutbox();
  const owners = await sweepOwnerJobs();
  return Response.json({ ok: true, outbox, ...owners });
}

/**
 * Recorre cada dueño activo y, de forma defensiva (el fallo de uno no aborta a los
 * demás), envía sus recordatorios de sesión vencidos y corre sus automatizaciones.
 */
async function sweepOwnerJobs(): Promise<{
  owners: number;
  sessionRemindersSent: number;
  automationErrors: number;
  reminderErrors: number;
}> {
  const db = getDatabaseAdapter();
  const owners = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('psychologist', 'professor', 'org_master') AND status = 'activo'`,
  );
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';

  // Dedupe de recordatorios: una reserva con un 'recordatorio_sesion' ya en el outbox no se reenvía.
  const alreadyReminded = async (bookingId: string): Promise<boolean> => {
    const row = await db.queryRow(
      `SELECT 1 AS x FROM outbox_messages WHERE booking_id = ? AND template = 'recordatorio_sesion' LIMIT 1`,
      [bookingId],
    );
    return row !== null;
  };

  let sessionRemindersSent = 0;
  let automationErrors = 0;
  let reminderErrors = 0;

  let eligibleOwners = 0;
  for (const { id: ownerUserId } of owners) {
    // El job no debe seguir enviando recordatorios ni campañas de una cuenta
    // suspendida o cuyo trial/suscripción ya venció. Los miembros cubiertos por
    // una organización se consideran activos mediante el mismo read model que
    // usa el acceso público a la agenda.
    if (!(await ownerHasActiveAppAccess(ownerUserId))) continue;
    eligibleOwners += 1;
    const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);

    // (2) Recordatorios de sesión de las citas próximas.
    try {
      const result = await new SendDueSessionReminders(
        new SqliteBookingRepository(ownerUserId),
        createSchedulingUseCases(ownerUserId).sendSessionReminder,
        profile?.sessionReminderHours ?? 24,
        alreadyReminded,
      ).run();
      sessionRemindersSent += result.sent;
    } catch {
      reminderErrors += 1;
    }

    // (3) Automatizaciones de marketing vencidas.
    try {
      await new RunDueAutomations(
        // El repositorio se crea DENTRO del ciclo: su owner es parte obligatoria
        // de la frontera y ninguna configuración se comparte entre iteraciones.
        new SqliteMarketingAutomationRepository(ownerUserId),
        new SqliteRecipientDirectory(ownerUserId),
        new SqliteAutomationDeliveryLog(ownerUserId),
        new OutboxEmailDispatcher(ownerUserId),
        new SqliteMessageTemplateOverrideRepository(ownerUserId),
      ).run({
        senderName: profile?.fullName || 'Tu profesional',
        scheduleLink: `${baseUrl}/reservar/${profile?.publicSlug ?? ''}`,
      });
    } catch {
      automationErrors += 1;
    }
  }

  return { owners: eligibleOwners, sessionRemindersSent, automationErrors, reminderErrors };
}
