'use server';

import { revalidatePath } from 'next/cache';
import { MarkManyBookingsPaid } from '@/contexts/billing/application/mark-many-bookings-paid/MarkManyBookingsPaid';
import { MarkManyBookingsPaidMessage } from '@/contexts/billing/application/mark-many-bookings-paid/MarkManyBookingsPaidMessage';
import { MarkManyBookingsUnpaid } from '@/contexts/billing/application/mark-many-bookings-unpaid/MarkManyBookingsUnpaid';
import { MarkManyBookingsUnpaidMessage } from '@/contexts/billing/application/mark-many-bookings-unpaid/MarkManyBookingsUnpaidMessage';
import { SqliteBookingPaymentRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBookingPaymentRepository';
import {
  assertPatientNotInInstitutionalCustody,
  requirePaymentWriteOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface PatientPaymentsActionState {
  ok: boolean;
  error?: string;
}

function revalidatePaymentViews(patientId: string): void {
  revalidatePath(`/pacientes/${patientId}/pagos`);
  revalidatePath(`/pacientes/${patientId}/sesiones`);
  revalidatePath('/pagos');
  revalidatePath('/inicio');
}

/**
 * Marca las sesiones seleccionadas como pagadas con un mismo método y fecha
 * (v2-spec §6.14: pensado para paquetes de 4/10 con descuento).
 */
export async function markSelectedPaidAction(input: {
  patientId: string;
  bookingIds: string[];
  method: string;
  paidAt?: string;
}): Promise<PatientPaymentsActionState> {
  const ownerUserId = await requirePaymentWriteOwnerUserId();
  await assertPatientNotInInstitutionalCustody(input.patientId, ownerUserId);
  try {
    const message = new MarkManyBookingsPaidMessage(input);
    // El paquete es todo-o-nada: si un id no resuelve a mitad del lote, se revierte
    // todo en vez de dejar unas sesiones pagadas y otras pendientes.
    await getDatabaseAdapter().transaction(() =>
      new MarkManyBookingsPaid(new SqliteBookingPaymentRepository(ownerUserId)).markPaid(message),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo registrar el pago.' };
  }
  revalidatePaymentViews(input.patientId);
  return { ok: true };
}

/** Devuelve las sesiones seleccionadas a estado pendiente (v2-spec §6.14). */
export async function markSelectedUnpaidAction(input: {
  patientId: string;
  bookingIds: string[];
}): Promise<PatientPaymentsActionState> {
  const ownerUserId = await requirePaymentWriteOwnerUserId();
  await assertPatientNotInInstitutionalCustody(input.patientId, ownerUserId);
  try {
    const message = new MarkManyBookingsUnpaidMessage(input);
    await getDatabaseAdapter().transaction(() =>
      new MarkManyBookingsUnpaid(new SqliteBookingPaymentRepository(ownerUserId)).markUnpaid(message),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo quitar el pago.' };
  }
  revalidatePaymentViews(input.patientId);
  return { ok: true };
}
