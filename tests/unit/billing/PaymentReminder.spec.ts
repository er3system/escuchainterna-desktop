import { describe, expect, it } from 'vitest';
import { PaymentReminder } from '@/contexts/billing/domain/PaymentReminder';
import { formatMoneyWithCode } from '@/shared/domain/currencies';

describe('PaymentReminder', () => {
  const reminder = PaymentReminder.forSession({
    bookingId: 'b-1',
    patientId: 'p-1',
    patientName: 'Ana López',
    patientPhone: '+52 555 123 4567',
    practitionerName: 'Karla Hernández',
    amount: 700,
    currency: 'MXN',
    sessionStartAt: '2026-06-05T20:00:00',
    paymentLink: 'http://localhost/pay/b-1',
    paymentPolicies: '💳 Pago y cancelaciones\nEl pago debe realizarse por adelantado.',
  });

  it('renders the WhatsApp body with amount, session date, payment link and policies', () => {
    const body = reminder.body();
    expect(body).toContain('💳 Recordatorio de pago');
    expect(body).toContain('Hola Ana López, tienes un pago pendiente de tu sesión con *Karla Hernández*.');
    expect(body).toContain('🗓️ *Sesión:* 05/06/2026');
    expect(body).toContain(`💵 *Monto:* ${formatMoneyWithCode(700, 'MXN')}`);
    expect(body).toContain('🔗 *Liga de pago:* http://localhost/pay/b-1');
    expect(body).toContain('El pago debe realizarse por adelantado.');
    expect(body).toContain('Mensaje automatizado: no responder a este mensaje.');
  });

  it('falls back to a generic practitioner name when the profile has none', () => {
    const anonymous = PaymentReminder.forSession({
      bookingId: 'b-2',
      patientId: 'p-1',
      patientName: 'Ana López',
      patientPhone: '',
      practitionerName: '   ',
      amount: 500,
      currency: 'MXN',
      sessionStartAt: '2026-06-05T20:00:00',
      paymentLink: 'http://localhost/pay/b-2',
      paymentPolicies: '',
    });
    expect(anonymous.body()).toContain('con *tu terapeuta*');
  });

  it('exposes outbox primitives with subject and recipient data', () => {
    const primitives = reminder.toPrimitives();
    expect(primitives.subject).toBe('Recordatorio de pago');
    expect(primitives.bookingId).toBe('b-1');
    expect(primitives.patientId).toBe('p-1');
    expect(primitives.patientPhone).toBe('+52 555 123 4567');
  });
});
