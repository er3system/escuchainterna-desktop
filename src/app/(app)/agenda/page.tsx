import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { CalendarBookingsQuery } from '@/contexts/scheduling/application/calendar-bookings/CalendarBookingsQuery';
import { SqliteSchedulingSettings } from '@/contexts/scheduling/infrastructure/persistence/SqliteSchedulingSettings';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { SqliteNotificationRepository } from '@/contexts/notifications/infrastructure/persistence/SqliteNotificationRepository';
import { requireDataOwnerUserId, isAssistantUser, isReceptionUser } from '@/shared/infrastructure/auth/dataOwner';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { redirect } from 'next/navigation';
import { listIntegrationConnections } from '../configuracion/integraciones/integrationConnections';
import { computeFreeGaps } from './freeSlots';
import { AgendaClient } from './AgendaClient';
import { parseAgendaView } from './agendaTypes';
import type { AgendaOption, CalendarBlockItem, PatientOption } from './agendaTypes';

/** Minutos desde medianoche (hora local) de un instante ISO, para calcular huecos. */
function minutesOfDay(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function parseAnchor(value: string | undefined): Date {
  if (value) {
    const parsed = parseISO(value);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

/**
 * Rango horario del grid de Semana/Día, adaptativo: nace de la disponibilidad
 * del profesional y se estira si hay reservas/bloqueos fuera de ella. Default
 * 8–20 si no hay nada. Así, si alguien atiende a las 2am, el grid lo muestra.
 */
function computeGridRange(
  availability: Array<{ ranges: Array<{ from: string; to: string }> }>,
  events: Array<{ startAt: string; endAt: string }>,
): { startHour: number; endHour: number } {
  // Baseline sensato; la disponibilidad y los eventos SOLO expanden hacia
  // afuera (nunca encogen), para que un único bloqueo no colapse la rejilla.
  let startHour = 8;
  let endHour = 20;
  for (const day of availability) {
    for (const range of day.ranges) {
      startHour = Math.min(startHour, Number(range.from.slice(0, 2)));
      const [eh, em] = range.to.split(':').map(Number);
      endHour = Math.max(endHour, em > 0 ? eh + 1 : eh);
    }
  }
  for (const event of events) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    if (!Number.isNaN(start.getTime())) startHour = Math.min(startHour, start.getHours());
    if (!Number.isNaN(end.getTime())) {
      endHour = Math.max(endHour, end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours());
    }
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  // La recepción multi-consultorio (§5) agenda por profesional destino en /recepcion, no
  // tiene agenda propia: se la envía allí (defensa por URL, además de ocultarlo del menú).
  const sessionUserId = await getSessionUserId();
  if (sessionUserId && (await isReceptionUser(sessionUserId))) redirect('/recepcion');
  const ownerUserId = await requireDataOwnerUserId();
  // El briefing IA del drawer está vedado al rol assistant (forbidAssistantRole en la
  // action generarBriefing): se calcula aquí — el server conoce el rol — para no mostrar
  // un botón que fallaría al clicar. La recepción ya fue redirigida arriba y, además,
  // su cuenta también es role='assistant', así que este check cubre ambos roles.
  const canUseAiBriefing = sessionUserId ? !(await isAssistantUser(sessionUserId)) : false;
  const params = await searchParams;
  const view = parseAgendaView(params.vista);
  const anchor = parseAnchor(params.fecha);

  let from: Date;
  let to: Date;
  if (view === 'semana') {
    from = startOfWeek(anchor, { weekStartsOn: 1 });
    to = endOfWeek(anchor, { weekStartsOn: 1 });
  } else if (view === 'dia') {
    from = startOfDay(anchor);
    to = endOfDay(anchor);
  } else {
    // mes y tabla comparten el periodo mensual; el grid del mes incluye semanas vecinas.
    from = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    to = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  }

  const useCases = createSchedulingUseCases(ownerUserId);
  const bookings = await useCases.calendarBookings.list(
    new CalendarBookingsQuery({
      fromIso: from.toISOString(),
      toIso: endOfDay(to).toISOString(),
    }),
  );

  // Espacios bloqueados del periodo visible (almuerzo, citas personales…).
  const blocks: CalendarBlockItem[] = (await useCases.listBlockedSlots.between(from, endOfDay(to))).map(
    (slot) => ({ id: slot.id, startAt: slot.startAt, endAt: slot.endAt, title: slot.title }),
  );

  // Rango horario adaptativo del grid (Semana/Día) según la disponibilidad
  // global del profesional, estirado para abarcar reservas/bloqueos del periodo.
  const availability = (await new SqliteSchedulingSettings(ownerUserId).getDefaults()).availability;
  const { startHour: gridStartHour, endHour: gridEndHour } = computeGridRange(availability, [
    ...bookings,
    ...blocks,
  ]);

  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const currency = profile?.currency ?? 'MXN';
  const defaultPrice = profile?.defaultPrice ?? 0;
  const defaultModality = (profile?.modality ?? 'ambas') as AgendaOption['modality'];

  const agendas: AgendaOption[] = (await useCases.listAgendas.list()).map((agenda) => ({
    id: agenda.id,
    name: agenda.name,
    color: agenda.color,
    slug: agenda.slug,
    durationMinutes: agenda.durationMinutes,
    price: agenda.paymentOverride ? agenda.paymentOverride.price : defaultPrice,
    // Moneda efectiva: override de la agenda ('' = perfil) o la del perfil.
    currency: agenda.paymentOverride?.currency || currency,
    modality: agenda.locationOverride ? agenda.locationOverride.modality : defaultModality,
    active: agenda.active,
  }));

  const patients: PatientOption[] = (
    await new SearchPatients(new SqlitePatientRepository(ownerUserId)).search(new SearchPatientsQuery({}))
  ).map((patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    email: patient.email,
    phone: patient.phone,
  }));

  // ----- Columna lateral operativa -----
  const nowIso = new Date().toISOString();
  // "Hoy" calculado en el servidor (determinista) para los defaults de los modales.
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const nameById = new Map(patients.map((patient) => [patient.id, patient.fullName]));

  // Sugerir conectar Google Calendar solo si la integración está desconectada.
  const gcal = (await listIntegrationConnections(ownerUserId)).find((c) => c.provider === 'google_calendar');
  const gcalConnected = gcal ? gcal.status !== 'desconectado' : false;

  // Recordatorios operativos próximos del titular (mismo dueño que la agenda y los
  // pacientes, así el nombre del paciente siempre resuelve): a futuro o sin fecha.
  const reminders = (
    await new SqliteNotificationRepository().listUpcomingReminders(ownerUserId, nowIso, 5)
  ).map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      remindAt: reminder.remindAt,
      patientName: reminder.patientId ? nameById.get(reminder.patientId) ?? null : null,
    }));

  // Próxima cita: la reserva agendada/confirmada más cercana en los próximos 45 días.
  const upcoming = await useCases.calendarBookings.list(
    new CalendarBookingsQuery({ fromIso: nowIso, toIso: addDays(new Date(), 45).toISOString() }),
  );
  const next = upcoming
    .filter((b) => b.startAt > nowIso && (b.status === 'agendada' || b.status === 'confirmada'))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  const nextAppointment = next
    ? { startAt: next.startAt, patientName: next.patientName, agendaName: next.agendaName }
    : null;

  // Huecos de HOY: la disponibilidad de hoy menos citas/bloqueos, desde ahora.
  const now = new Date();
  const todayRanges = availability.find((day) => day.day === now.getDay())?.ranges ?? [];
  const todaysBookings = await useCases.calendarBookings.list(
    new CalendarBookingsQuery({ fromIso: startOfDay(now).toISOString(), toIso: endOfDay(now).toISOString() }),
  );
  const todaysBlocks = await useCases.listBlockedSlots.between(startOfDay(now), endOfDay(now));
  const busyToday = [
    ...todaysBookings
      .filter((booking) => booking.status !== 'cancelada')
      .map((booking) => ({ start: minutesOfDay(booking.startAt), end: minutesOfDay(booking.endAt) })),
    ...todaysBlocks.map((slot) => ({ start: minutesOfDay(slot.startAt), end: minutesOfDay(slot.endAt) })),
  ];
  const freeSlotsToday = computeFreeGaps(todayRanges, busyToday, now.getHours() * 60 + now.getMinutes()).slice(
    0,
    5,
  );

  const reminderPatients = patients.map((patient) => ({ id: patient.id, fullName: patient.fullName }));

  // Sedes para el selector de sesión (Modo Sedes, MS3): solo si la org del dueño está en
  // modo 'compartido'. Map a objetos PLANOS (filas de sqlite con prototipo null no serializan).
  const ownerOrg = (await getDatabaseAdapter().queryRow(
    `SELECT o.id AS org_id, o.consultorio_mode AS mode
         FROM organization_memberships m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ? LIMIT 1`,
    [ownerUserId],
  )) as { org_id: string; mode: string } | null;
  const consultorios =
    ownerOrg && ownerOrg.mode === 'compartido'
      ? (
          (await getDatabaseAdapter().query(
            `SELECT id, name FROM consultorios WHERE organization_id = ? AND archived = 0 ORDER BY created_at ASC`,
            [ownerOrg.org_id],
          )) as unknown as Array<{ id: string; name: string }>
        ).map((row) => ({ id: row.id, name: row.name }))
      : [];

  return (
    <AgendaClient
      view={view}
      anchorIso={format(anchor, 'yyyy-MM-dd')}
      bookings={bookings}
      blocks={blocks}
      agendas={agendas}
      patients={patients}
      currency={currency}
      gridStartHour={gridStartHour}
      gridEndHour={gridEndHour}
      todayIso={todayIso}
      gcalConnected={gcalConnected}
      nextAppointment={nextAppointment}
      reminders={reminders}
      reminderPatients={reminderPatients}
      freeSlotsToday={freeSlotsToday}
      consultorios={consultorios}
      canUseAiBriefing={canUseAiBriefing}
    />
  );
}
