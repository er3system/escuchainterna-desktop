'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ban,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  ExternalLink,
  Link2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  StickyNote,
  UserX,
  Video,
} from 'lucide-react';
import {
  cancelBookingAction,
  completeBookingAction,
  confirmBookingAction,
  getBookingDetailAction,
  getBookingMessagesAction,
  markNoShowAction,
  rescheduleBookingAction,
  resendManagementLinkAction,
  sendReminderAction,
} from './actions';
import type { BookingDetail, BookingMessage, CalendarBookingItem } from './agendaTypes';
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL, formatMoney } from './agendaTypes';
import { BTN_DANGER, BTN_OUTLINE, BTN_PRIMARY, Drawer, FieldLabel, Modal } from './Modal';
import { StatusBadge } from './views';
import { Input } from '@/components/ui';
import { MessageBodyView } from '@/components/MessageBodyView';
import { SessionBriefingCard } from '@/app/(app)/pacientes/[id]/SessionBriefingCard';

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-ink-soft">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
        <div className="text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export function BookingDetailDrawer({
  booking,
  currency,
  onClose,
  onChanged,
  canUseAiBriefing = true,
}: {
  booking: CalendarBookingItem;
  currency: string;
  onClose: () => void;
  onChanged: () => void;
  /**
   * ¿La sesión puede usar el briefing IA? La server action (`generarBriefing`)
   * rechaza a los roles assistant/recepción, así que sin este gate esos roles
   * verían el botón y recibirían un error al clicar. Lo decide el server
   * component de la página (que conoce el rol). Default true: el único
   * call-site real (AgendaClient) siempre lo recibe de la página; si mañana
   * otro call-site lo omite, mostrar la tarjeta de más es solo cosmético
   * porque el guard real sigue siendo el del servidor.
   */
  canUseAiBriefing?: boolean;
}) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [sedeName, setSedeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[] | null>(null);
  const [newDate, setNewDate] = useState(format(parseISO(booking.startAt), 'yyyy-MM-dd'));
  const [newTime, setNewTime] = useState(format(parseISO(booking.startAt), 'HH:mm'));

  const status = detail?.booking.status ?? booking.status;
  const isOpen = status === 'agendada' || status === 'confirmada';

  useEffect(() => {
    let active = true;
    getBookingDetailAction(booking.id)
      .then((result) => {
        if (!active) return;
        if (result.detail) {
          setDetail(result.detail);
          setSedeName(result.sedeName ?? null);
        } else setError(result.error ?? null);
      })
      .catch(() => {
        // Falla de red: sin esto el drawer quedaría en esqueleto para siempre.
        if (active) setError('No pudimos cargar el detalle de la reservación.');
      });
    return () => {
      active = false;
    };
  }, [booking.id]);

  const reloadDetail = () => {
    // Refresco best-effort: si falla, el drawer conserva el detalle anterior.
    void getBookingDetailAction(booking.id).then((result) => {
      if (result.detail) setDetail(result.detail);
      if (result.detail) setSedeName(result.sedeName ?? null);
    });
  };

  const runAction = (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? 'Ocurrió un error inesperado.');
        return;
      }
      setFeedback(successMessage);
      reloadDetail();
      onChanged();
    });
  };

  const openMessages = () => {
    setShowMessages(true);
    setMessages(null);
    getBookingMessagesAction(booking.id)
      .then((result) => setMessages(result.messages))
      .catch(() => {
        // Falla de red: cierra el modal (quedaría en "cargando" eterno) y avisa.
        setShowMessages(false);
        setError('No pudimos cargar los mensajes de esta reservación.');
      });
  };

  const start = parseISO(detail?.booking.startAt ?? booking.startAt);
  const end = parseISO(detail?.booking.endAt ?? booking.endAt);
  const modality = detail?.booking.modality ?? booking.modality;
  const paymentStatus = detail?.booking.paymentStatus ?? booking.paymentStatus;
  const price = detail?.booking.price ?? booking.price;
  // Moneda del cobro de ESTA reserva (puede diferir de la del perfil).
  const bookingCurrency = detail?.booking.currency || booking.currency || currency;

  return (
    <Drawer title="Detalle de la reservación" onClose={onClose}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-ink">
            Sesión con{' '}
            <Link
              href={`/pacientes/${detail?.patient.id ?? booking.patientId}`}
              className="text-primary dark:text-accent-2 underline-offset-2 hover:underline"
              title="Ver expediente del paciente"
            >
              {booking.patientName}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {format(start, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })} · {format(start, 'HH:mm')}–
            {format(end, 'HH:mm')}
          </p>
          <Link
            href={`/pacientes/${detail?.patient.id ?? booking.patientId}`}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-accent-2 hover:underline"
          >
            <ExternalLink size={12} /> Ver expediente
          </Link>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: `${booking.agendaColor}1a`, color: booking.agendaColor }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: booking.agendaColor }} />
        {booking.agendaName}
      </div>

      {/* Briefing pre-sesión: solo para citas próximas (agendada/confirmada), el momento más
          útil, y solo para roles con acceso a la IA (canUseAiBriefing). */}
      {canUseAiBriefing && isOpen && (detail?.patient.id ?? booking.patientId) ? (
        <div className="mb-3">
          <SessionBriefingCard patientId={detail?.patient.id ?? booking.patientId} />
        </div>
      ) : null}

      <div className="divide-y divide-line rounded-card border border-line px-4">
        <DetailRow icon={<Phone size={15} />} label="Celular">
          {detail ? detail.patient.phone || '—' : 'Cargando…'}
        </DetailRow>
        <DetailRow icon={<Mail size={15} />} label="Correo">
          {detail ? detail.patient.email || '—' : 'Cargando…'}
        </DetailRow>
        <DetailRow
          icon={modality === 'virtual' ? <Video size={15} /> : <MapPin size={15} />}
          label="Modalidad"
        >
          {modality === 'virtual' ? 'Virtual (videollamada)' : 'Presencial'}
          {modality === 'virtual' && detail?.booking.meetUrl ? (
            <a
              href={detail.booking.meetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 flex items-center gap-1 text-primary dark:text-accent-2 hover:underline"
            >
              <Link2 size={13} /> {detail.booking.meetUrl}
            </a>
          ) : null}
          {modality === 'presencial' && detail?.address ? (
            <p className="mt-0.5 text-sm text-ink-soft">{detail.address}</p>
          ) : null}
          {modality === 'presencial' && detail?.mapsUrl ? (
            <a
              href={detail.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 flex items-center gap-1 text-primary dark:text-accent-2 hover:underline"
            >
              <Link2 size={13} /> Ver en Google Maps
            </a>
          ) : null}
        </DetailRow>
        {sedeName ? (
          <DetailRow icon={<MapPin size={15} />} label="Sede">
            {sedeName}
          </DetailRow>
        ) : null}
        <DetailRow icon={<CheckCheck size={15} />} label="Pago">
          <span className={paymentStatus === 'pagada' ? 'font-medium text-success' : 'font-medium text-danger'}>
            {PAYMENT_STATUS_LABEL[paymentStatus]}
          </span>{' '}
          · {formatMoney(price, bookingCurrency)}
          {detail?.booking.paidAt ? (
            <p className="text-xs text-ink-soft">
              Pagada el {format(parseISO(detail.booking.paidAt), "d 'de' MMMM yyyy", { locale: es })}
              {detail.booking.paymentMethod ? ` · ${detail.booking.paymentMethod}` : ''}
            </p>
          ) : null}
        </DetailRow>
        <DetailRow icon={<CalendarClock size={15} />} label="Origen">
          {(detail?.booking.bookedBy ?? 'profesional') === 'paciente'
            ? 'Agendada por el paciente (página pública)'
            : 'Agendada por ti'}
          {detail?.booking.recurrenceId ? (
            <p className="text-xs text-ink-soft">Forma parte de una serie recurrente.</p>
          ) : null}
        </DetailRow>
      </div>

      {detail?.booking.patientNote ? (
        <div className="mt-3 rounded-card border border-line bg-bg/60 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <StickyNote size={14} /> Nota del paciente
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink">{detail.booking.patientNote}</p>
        </div>
      ) : null}

      <div className="mt-3 min-h-5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
      </div>

      <div className="mt-1 grid grid-cols-2 gap-2">
        {status === 'agendada' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => runAction(() => confirmBookingAction(booking.id), 'Sesión confirmada.')}
            className={`${BTN_PRIMARY} flex items-center justify-center gap-1.5`}
          >
            <Check size={15} /> Confirmar
          </button>
        ) : null}
        {isOpen ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowReschedule(true)}
              className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5`}
            >
              <CalendarClock size={15} /> Reagendar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => completeBookingAction(booking.id), 'Sesión marcada como completada.')}
              className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5 text-success`}
            >
              <CheckCheck size={15} /> Completada
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => markNoShowAction(booking.id), 'Inasistencia registrada.')}
              className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5 text-warning`}
            >
              <UserX size={15} /> Inasistencia
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => sendReminderAction(booking.id),
                  'Recordatorio registrado: revísalo en Mensajes.',
                )
              }
              className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5`}
            >
              <BellRing size={15} /> Enviar recordatorio
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowCancelConfirm(true)}
              className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5 text-danger`}
            >
              <Ban size={15} /> Cancelar
            </button>
          </>
        ) : null}
        {status !== 'cancelada' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              runAction(
                () => resendManagementLinkAction(booking.id),
                'Liga de gestión reenviada: revísala en Mensajes.',
              )
            }
            className={`${BTN_OUTLINE} col-span-2 flex items-center justify-center gap-1.5`}
            title="Reenvía al paciente la liga pública para ver, pagar, reagendar o cancelar su sesión"
          >
            <Link2 size={15} /> Reenviar link de gestión
          </button>
        ) : null}
        <button
          type="button"
          onClick={openMessages}
          className={`${BTN_OUTLINE} col-span-2 flex items-center justify-center gap-1.5`}
        >
          <MessageSquareText size={15} /> Ver mensajes
        </button>
      </div>

      {showReschedule ? (
        <Modal title="Reagendar sesión" onClose={() => setShowReschedule(false)}>
          <p className="mb-3 text-sm text-ink-soft">
            Elige la nueva fecha y hora. Validamos que no se empalme con otras sesiones.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <FieldLabel required>Fecha</FieldLabel>
              <Input
                type="date"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
              />
            </label>
            <label>
              <FieldLabel required>Hora</FieldLabel>
              <Input
                type="time"
                value={newTime}
                onChange={(event) => setNewTime(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowReschedule(false)} className={BTN_OUTLINE}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending || !newDate || !newTime}
              onClick={() => {
                runAction(
                  () => rescheduleBookingAction({ bookingId: booking.id, date: newDate, time: newTime }),
                  'Sesión reagendada: se notificó al paciente.',
                );
                setShowReschedule(false);
              }}
              className={BTN_PRIMARY}
            >
              Reagendar
            </button>
          </div>
        </Modal>
      ) : null}

      {showCancelConfirm ? (
        <Modal title="Cancelar sesión" onClose={() => setShowCancelConfirm(false)}>
          <p className="text-lg font-bold text-ink">¿Estás seguro?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Esta acción no se puede deshacer. Se notificará la cancelación al paciente.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCancelConfirm(false)} className={BTN_OUTLINE}>
              Volver
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                runAction(() => cancelBookingAction(booking.id), 'Sesión cancelada.');
                setShowCancelConfirm(false);
              }}
              className={BTN_DANGER}
            >
              Cancelar sesión
            </button>
          </div>
        </Modal>
      ) : null}

      {showMessages ? (
        <Modal title="Mensajes de esta reservación" onClose={() => setShowMessages(false)} wide>
          {messages === null ? (
            <p className="py-8 text-center text-sm text-ink-soft">Cargando mensajes…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              Esta reservación todavía no tiene mensajes registrados.
            </p>
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <li key={message.id} className="rounded-card border border-line p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        message.channel === 'whatsapp'
                          ? 'bg-success-soft text-success'
                          : 'bg-primary-light text-primary'
                      }`}
                    >
                      {message.channel === 'whatsapp' ? 'WhatsApp' : 'Correo'}
                    </span>
                    <span className="font-medium text-ink">{message.templateLabel}</span>
                    <span className="text-ink-soft">
                      {format(parseISO(message.createdAt), "d/M/yyyy, h:mm:ss aaaa", { locale: es })}
                    </span>
                    <span className="ml-auto rounded-full bg-bg px-2 py-0.5 font-medium text-ink-soft">
                      {message.status}
                    </span>
                  </div>
                  <MessageBodyView body={message.body} height="20rem" />
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </Drawer>
  );
}
