'use server';

import { revalidatePath } from 'next/cache';
import { MarkBookingPaid } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaid';
import { MarkBookingPaidMessage } from '@/contexts/billing/application/mark-booking-paid/MarkBookingPaidMessage';
import { SqliteBookingPaymentRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBookingPaymentRepository';
import {
  isGatewayActiveForPatients,
  isPaymentGatewayProvider,
} from '@/contexts/practitioner/domain/paymentGateways';
import { paymentCheckoutIsSimulated } from '@/contexts/practitioner/infrastructure/payments/createPaymentCheckoutProvider';
import { SqlitePaymentGatewayRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { CancelBookingMessage } from '@/contexts/scheduling/application/cancel-booking/CancelBookingMessage';
import type { DayAvailableSlots } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlots';
import { FindAvailableSlotsQuery } from '@/contexts/scheduling/application/find-available-slots/FindAvailableSlotsQuery';
import { RescheduleBookingMessage } from '@/contexts/scheduling/application/reschedule-booking/RescheduleBookingMessage';
import { CancellationWindowClosedError } from '@/contexts/scheduling/domain/errors/CancellationWindowClosedError';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { convertAmount, getExchangeRates } from '@/shared/infrastructure/exchange-rates/ExchangeRates';
import { ownerCanActuallyCharge } from '@/shared/infrastructure/auth/dataOwner';
import { findPublicSession } from './publicSessionData';

export interface PayPublicSessionResult {
  ok: boolean;
  error?: string;
}

export interface ConvertSessionAmountResult {
  ok: boolean;
  /** Monto aproximado en la moneda elegida (2 decimales). */
  amount?: number;
  error?: string;
}

/**
 * Conversión APROXIMADA del monto de la sesión a la moneda que el paciente
 * elige en "Pagar en:" (selector del checkout simulado). Solo informativa:
 * el pago se registra SIEMPRE en la moneda original de la sesión; en
 * producción la conversión real la hace la pasarela (Stripe Adaptive
 * Pricing / PayPal multi-moneda) o el banco del paciente (Mercado Pago).
 *
 * El monto se relee de la BD por bookingId (no se confía en el cliente).
 */
export async function convertPublicSessionAmountAction(input: {
  bookingId: string;
  currency: string;
}): Promise<ConvertSessionAmountResult> {
  try {
    const target = input.currency.trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.some((currency) => currency.code === target)) {
      return { ok: false, error: 'Moneda no soportada.' };
    }
    const session = await findPublicSession(input.bookingId);
    if (!session) return { ok: false, error: 'La sesión ya no está disponible.' };
    if (!(await ownerCanActuallyCharge(session.ownerUserId))) {
      return { ok: false, error: 'El pago no está disponible para esta sesión.' };
    }
    if (target === session.currency) return { ok: true, amount: session.price };

    const rates = await getExchangeRates(session.currency);
    const converted = convertAmount(session.price, session.currency, target, rates);
    if (converted === null) {
      return { ok: false, error: 'No hay tasa de cambio disponible para esa moneda.' };
    }
    return { ok: true, amount: Math.round(converted * 100) / 100 };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo calcular la conversión.',
    };
  }
}

/**
 * Checkout SIMULADO del modo local: marca la sesión como pagada
 * (payment_status='pagada', method='stripe'|'mercado_pago'|'paypal', paid_at)
 * reutilizando el caso de uso de billing MarkBookingPaid. El pago se
 * registra SIEMPRE en la moneda original de la sesión, aunque el paciente
 * haya usado el selector "Pagar en" (esa conversión es solo informativa).
 *
 * En producción este paso lo disparará el webhook/el retorno del checkout
 * real de la pasarela (ver adaptadores StripeCheckout / MercadoPagoCheckout /
 * PayPalCheckout), nunca el navegador del paciente.
 */
export async function payPublicSessionAction(input: {
  bookingId: string;
  provider: string;
}): Promise<PayPublicSessionResult> {
  try {
    if (!isPaymentGatewayProvider(input.provider)) {
      return { ok: false, error: 'Método de pago desconocido.' };
    }
    const session = await findPublicSession(input.bookingId);
    if (!session) return { ok: false, error: 'La sesión ya no está disponible.' };
    if (!(await ownerCanActuallyCharge(session.ownerUserId))) {
      return { ok: false, error: 'El pago no está disponible para esta sesión.' };
    }
    if (session.status === 'cancelada') {
      return { ok: false, error: 'Esta sesión fue cancelada; no requiere pago.' };
    }
    if (session.paymentStatus === 'pagada') return { ok: true }; // idempotente

    // El botón solo es válido si el profesional tiene la pasarela habilitada.
    const gateway = await new SqlitePaymentGatewayRepository().find(input.provider, session.ownerUserId);
    if (!gateway || !isGatewayActiveForPatients(gateway)) {
      return { ok: false, error: 'El profesional no tiene habilitado este método de pago.' };
    }

    // Los links externos no confirman el pago: sin webhook, el profesional lo
    // concilia manualmente. Esta action existe únicamente para la simulación
    // local y nunca debe convertir un clic externo en un pago acreditado.
    if (!paymentCheckoutIsSimulated(gateway)) {
      return {
        ok: false,
        error: 'El pago externo queda pendiente hasta que el profesional confirme la recepción.',
      };
    }

    // En producción se rechaza server-side aunque alguien invoque la action
    // sin pasar por la UI: la simulación no mueve dinero.
    if (isProduction()) {
      return {
        ok: false,
        error: 'Los pagos en línea aún no están disponibles; coordina el pago directamente con tu profesional.',
      };
    }

    await new MarkBookingPaid(new SqliteBookingPaymentRepository(session.ownerUserId)).markPaid(
      new MarkBookingPaidMessage({ bookingId: session.bookingId, method: input.provider }),
    );

    revalidatePath(`/sesion/${session.bookingId}`);
    revalidatePath('/pagos');
    revalidatePath('/inicio');
    revalidatePath('/agenda');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo registrar el pago. Intenta de nuevo.',
    };
  }
}

// ---------------------------------------------------------------------------
// Gestión pública de la sesión por el paciente (v3-spec §6): reagendar con
// los horarios disponibles del profesional y cancelar con confirmación.
// El bookingId UUID no adivinable es la "llave" de la página, igual que en el
// flujo de pago; el owner SIEMPRE se resuelve en el servidor desde la reserva.
// ---------------------------------------------------------------------------

export interface ManagePublicSessionResult {
  ok: boolean;
  error?: string;
  /**
   * true cuando el cambio se rechazó por la ventana mínima de cancelación:
   * la UI lo muestra de forma amable e invita a contactar al profesional.
   */
  windowClosed?: boolean;
}

function refreshPublicSessionPaths(bookingId: string): void {
  revalidatePath(`/sesion/${bookingId}`);
  revalidatePath('/agenda');
  revalidatePath('/pagos');
  revalidatePath('/inicio');
  revalidatePath('/mensajes');
}

/**
 * Horarios disponibles del dueño de la sesión para el selector de "Reagendar"
 * (FindAvailableSlots sobre la MISMA agenda de la reserva).
 */
export async function getPublicSessionSlotsAction(input: {
  bookingId: string;
  fromDate: string;
  days?: number;
}): Promise<{ days: DayAvailableSlots[]; error?: string }> {
  try {
    const session = await findPublicSession(input.bookingId);
    if (!session) return { days: [], error: 'La sesión ya no está disponible.' };
    const query = new FindAvailableSlotsQuery({
      agendaId: session.agendaId,
      fromDate: input.fromDate,
      days: input.days ?? 14,
    });
    return { days: await createSchedulingUseCases(session.ownerUserId).findAvailableSlots.find(query) };
  } catch (error) {
    return {
      days: [],
      error: error instanceof Error ? error.message : 'No se pudo cargar la disponibilidad.',
    };
  }
}

/**
 * Reagendado por el paciente (actor 'paciente'): aplica la ventana mínima de
 * cancelación y la disponibilidad efectiva de la agenda (RescheduleBooking).
 * Dispara los mensajes de "sesión reagendada" (WhatsApp + correo) del outbox.
 */
export async function reschedulePublicSessionAction(input: {
  bookingId: string;
  /** Fecha 'yyyy-MM-dd' y hora 'HH:mm' locales del nuevo horario. */
  date: string;
  time: string;
}): Promise<ManagePublicSessionResult> {
  try {
    const session = await findPublicSession(input.bookingId);
    if (!session) return { ok: false, error: 'La sesión ya no está disponible.' };
    if (session.status !== 'agendada' && session.status !== 'confirmada') {
      return { ok: false, error: 'Esta sesión ya no se puede reagendar en línea.' };
    }
    const newStartIso = new Date(`${input.date}T${input.time}:00`).toISOString();
    const message = new RescheduleBookingMessage({
      bookingId: session.bookingId,
      newStartIso,
      actor: 'paciente',
    });
    await createSchedulingUseCases(session.ownerUserId).rescheduleBooking.reschedule(message);
    refreshPublicSessionPaths(session.bookingId);
    return { ok: true };
  } catch (error) {
    if (error instanceof CancellationWindowClosedError) {
      return { ok: false, windowClosed: true, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo reagendar la sesión. Intenta de nuevo.',
    };
  }
}

/**
 * Cancelación por el paciente (actor 'paciente'): la ventana mínima aplica.
 * Dispara los mensajes de "sesión cancelada" (WhatsApp + correo) del outbox.
 */
export async function cancelPublicSessionAction(input: {
  bookingId: string;
}): Promise<ManagePublicSessionResult> {
  try {
    const session = await findPublicSession(input.bookingId);
    if (!session) return { ok: false, error: 'La sesión ya no está disponible.' };
    if (session.status === 'cancelada') return { ok: true }; // idempotente
    if (session.status !== 'agendada' && session.status !== 'confirmada') {
      return { ok: false, error: 'Esta sesión ya no se puede cancelar en línea.' };
    }
    const message = new CancelBookingMessage({ bookingId: session.bookingId, actor: 'paciente' });
    await createSchedulingUseCases(session.ownerUserId).cancelBooking.cancel(message);
    refreshPublicSessionPaths(session.bookingId);
    return { ok: true };
  } catch (error) {
    if (error instanceof CancellationWindowClosedError) {
      return { ok: false, windowClosed: true, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo cancelar la sesión. Intenta de nuevo.',
    };
  }
}
