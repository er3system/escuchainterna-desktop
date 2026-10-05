import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Video,
  XCircle,
} from 'lucide-react';
import { paymentMethodLabelFor } from '@/contexts/billing/domain/value-objects/paymentMethodLabels';
import {
  PAYMENT_GATEWAY_LABELS,
  isPaymentGatewayProvider,
  type PaymentGatewayProvider,
} from '@/contexts/practitioner/domain/paymentGateways';
import { createPaymentCheckoutProvider } from '@/contexts/practitioner/infrastructure/payments/createPaymentCheckoutProvider';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { SqlitePaymentGatewayRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository';
import { SqliteSchedulingSettings } from '@/contexts/scheduling/infrastructure/persistence/SqliteSchedulingSettings';
import { ownerHasFreeService } from '@/contexts/identity/infrastructure/persistence/SqliteFreeServiceReader';
import { ownerCanActuallyCharge } from '@/shared/infrastructure/auth/dataOwner';
import { formatMoney } from '@/shared/domain/currencies';
import { GestionarSesion } from './GestionarSesion';
import { PagarConsulta, type PublicGatewayOption } from './PagarConsulta';
import { findPublicSession } from './publicSessionData';

export const metadata: Metadata = {
  title: 'Tu sesión · EscuchaInterna',
};

/**
 * Página PÚBLICA de detalle/pago de una sesión (sin login, accesible por el
 * id UUID de la reserva). Es el destino de la liga de pago de WhatsApp y del
 * enlace "Ver mi sesión / pagar" de la confirmación de /reservar.
 * Muestra SOLO datos mínimos: profesional, fecha/hora, monto y estado de pago.
 */
export default async function SesionPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { bookingId } = await params;
  const { checkout } = await searchParams;

  const session = await findPublicSession(bookingId);
  if (!session) notFound();
  const paymentsEnabled = await ownerCanActuallyCharge(session.ownerUserId);

  // Pasarelas habilitadas por el profesional; la URL de checkout se genera
  // por el puerto PaymentCheckoutProvider (adaptador local simulado hoy).
  const gateways: PublicGatewayOption[] = paymentsEnabled
    ? (await new SqlitePaymentGatewayRepository().listActiveForPatients(session.ownerUserId))
        .map((settings) => {
          const checkoutProvider = createPaymentCheckoutProvider(settings);
          return {
            provider: settings.provider,
            label: PAYMENT_GATEWAY_LABELS[settings.provider],
            mode: checkoutProvider.mode(),
            checkoutUrl: checkoutProvider.createCheckoutUrl(
              {
                bookingId: session.bookingId,
                amount: session.price,
                currency: session.currency,
                concept: `${session.agendaName} con ${session.practitionerName}`,
              },
              settings,
            ),
          };
        })
        .filter((gateway) => !isProduction() || gateway.mode !== 'local_simulation')
    : [];

  const cancelled = session.status === 'cancelada';
  const paid = session.paymentStatus === 'pagada';
  // v3 §3 (universidades): organización con servicio sin costo ⇒ la página
  // pública no muestra monto, estado de pago ni botón de pago.
  const freeService = await ownerHasFreeService(session.ownerUserId);
  const paymentsUnavailable = freeService || !paymentsEnabled;
  const canPay =
    !cancelled && !paid && session.price > 0 && gateways.length > 0 && !paymentsUnavailable;
  // El paciente solo puede reagendar/cancelar sesiones abiertas (v3-spec §6).
  const canManage = session.status === 'agendada' || session.status === 'confirmada';
  const minCancellationHours = canManage
    ? (await new SqliteSchedulingSettings(session.ownerUserId).getDefaults()).cancellationMinHours
    : 0;
  const initialCheckout: PaymentGatewayProvider | null =
    checkout && isPaymentGatewayProvider(checkout) && canPay ? checkout : null;

  const startAt = parseISO(session.startAt);

  // Tarjeta "Cómo llegar / contacto": según la modalidad efectiva de la sesión
  // mostramos cómo asistir (dirección o videollamada) y, opcionalmente, el
  // contacto del profesional (WhatsApp / correo). Si la sesión está cancelada
  // o no hay nada configurado para mostrar, la tarjeta no se renderiza.
  const isVirtual = session.modality === 'virtual';
  const { contact } = session;
  const showHowToArrive = !cancelled && (isVirtual ? Boolean(contact.meetUrl) : Boolean(contact.address));
  const showProfessionalContact = Boolean(contact.whatsapp || contact.email);
  const showContactCard = showHowToArrive || showProfessionalContact;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <p className="text-lg font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-center text-2xl font-bold text-ink">Tu sesión</h1>
        {session.patientFirstName ? (
          <p className="mt-1 text-center text-sm text-ink-soft">
            Hola {session.patientFirstName}, aquí está el detalle de tu sesión.
          </p>
        ) : null}
        <div className="mx-auto mt-2 mb-6 h-1 w-16 rounded-full bg-primary" />

        <section className="rounded-card border border-line bg-surface p-6 shadow-card">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-ink">Profesional:</dt>
              <dd className="text-right text-ink">{session.practitionerName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-ink">Sesión:</dt>
              <dd className="text-right text-ink">{session.agendaName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <CalendarDays size={14} /> Fecha:
              </dt>
              <dd className="text-right capitalize text-ink">
                {format(startAt, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="flex items-center gap-1.5 font-semibold text-ink">
                <Clock3 size={14} /> Hora:
              </dt>
              <dd className="text-right text-ink">
                {format(startAt, 'h:mm aaaa', { locale: es })} · {session.durationMinutes} min
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-ink">Modalidad:</dt>
              <dd className="flex items-center justify-end gap-1.5 text-right text-ink">
                {session.modality === 'virtual' ? (
                  <>
                    <Video size={14} /> Videollamada
                  </>
                ) : (
                  <>
                    <MapPin size={14} /> Presencial
                  </>
                )}
              </dd>
            </div>
            {paymentsUnavailable ? (
              <div className="flex justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Costo:</dt>
                <dd className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                    <CheckCircle2 size={12} /> {freeService ? 'Sin costo' : 'Pago no disponible'}
                  </span>
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-3 border-t border-line pt-3">
                  <dt className="font-semibold text-ink">Monto:</dt>
                  <dd className="text-right text-base font-bold text-ink">
                    {formatMoney(session.price, session.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Estado de pago:</dt>
                  <dd className="text-right">
                    {paid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                        <CheckCircle2 size={12} /> Pagada · {paymentMethodLabelFor(session.paymentMethod)}
                      </span>
                    ) : cancelled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">
                        <XCircle size={12} /> Sesión cancelada
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                        Pago pendiente
                      </span>
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        {showContactCard ? (
          <section className="mt-6 rounded-card border border-line bg-surface p-6 shadow-card">
            <h2 className="text-sm font-bold text-ink">Cómo llegar / contacto</h2>
            <div className="mt-3 space-y-4">
              {showHowToArrive && isVirtual && contact.meetUrl ? (
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Video size={15} /> Tu sesión es por videollamada
                  </p>
                  <a
                    href={contact.meetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
                  >
                    <Video size={15} /> Entrar a la videollamada
                  </a>
                </div>
              ) : null}

              {showHowToArrive && !isVirtual && contact.address ? (
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <MapPin size={15} /> Dirección
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{contact.address}</p>
                  {contact.mapsUrl ? (
                    <a
                      href={contact.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-bg"
                    >
                      <MapPin size={15} /> Ver en Google Maps
                    </a>
                  ) : null}
                </div>
              ) : null}

              {showProfessionalContact ? (
                <div className={showHowToArrive ? 'border-t border-line pt-4' : ''}>
                  <p className="text-sm font-semibold text-ink">
                    ¿Dudas? Contacta a {session.practitionerName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contact.whatsapp ? (
                      <a
                        href={`https://wa.me/${contact.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-bg"
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </a>
                    ) : null}
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-bg"
                      >
                        <Mail size={15} /> Correo
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="mt-6">
          {paymentsUnavailable && !paid ? (
            cancelled ? (
              <p className="text-center text-sm text-ink-soft">
                Esta sesión fue cancelada. Si necesitas reagendar, contacta a{' '}
                {session.practitionerName}.
              </p>
            ) : (
              <p className="text-center text-sm text-ink-soft">
                {freeService
                  ? 'Esta sesión no tiene costo: tu institución cubre el servicio. ¡Nos vemos en tu sesión!'
                  : `Los pagos están deshabilitados para esta cuenta. Contacta a ${session.practitionerName} para coordinar tu sesión.`}
              </p>
            )
          ) : paid ? (
            <div className="rounded-card border border-line bg-success-soft p-6 text-center">
              <CheckCircle2 size={44} className="mx-auto text-success" />
              <p className="mt-3 text-lg font-bold text-ink">Sesión pagada</p>
              <p className="mt-1 text-sm text-ink-soft">
                {session.paidAt
                  ? `Pago registrado el ${format(parseISO(session.paidAt), "d 'de' MMMM 'de' yyyy", { locale: es })} vía ${paymentMethodLabelFor(session.paymentMethod)}.`
                  : `Pago registrado vía ${paymentMethodLabelFor(session.paymentMethod)}.`}{' '}
                ¡Nos vemos en tu sesión!
              </p>
            </div>
          ) : cancelled ? (
            <p className="text-center text-sm text-ink-soft">
              Esta sesión fue cancelada y no requiere pago. Si necesitas reagendar, contacta a{' '}
              {session.practitionerName}.
            </p>
          ) : canPay ? (
            <PagarConsulta
              bookingId={session.bookingId}
              amount={session.price}
              currency={session.currency}
              practitionerName={session.practitionerName}
              gateways={gateways}
              initialCheckout={initialCheckout}
            />
          ) : (
            <p className="text-center text-sm text-ink-soft">
              {session.price > 0
                ? `El pago se coordina directamente con ${session.practitionerName} (aún no tiene pagos en línea habilitados).`
                : 'Esta sesión no requiere pago en línea.'}
            </p>
          )}
        </div>

        {canManage ? (
          <GestionarSesion
            bookingId={session.bookingId}
            practitionerName={session.practitionerName}
            minCancellationHours={minCancellationHours}
          />
        ) : null}
      </main>

      <footer className="pb-8 text-center text-xs text-ink-soft">
        Sesión con {session.practitionerName} · EscuchaInterna
      </footer>
    </div>
  );
}
