import { describe, expect, it } from 'vitest';
import { GetPaymentReminderTemplate } from '@/contexts/billing/application/get-payment-reminder-template/GetPaymentReminderTemplate';
import { UpdatePaymentReminderTemplate } from '@/contexts/billing/application/update-payment-reminder-template/UpdatePaymentReminderTemplate';
import { UpdatePaymentReminderTemplateMessage } from '@/contexts/billing/application/update-payment-reminder-template/UpdatePaymentReminderTemplateMessage';
import {
  PaymentReminderTemplateContent,
  PaymentReminderTemplateRepository,
} from '@/contexts/billing/domain/repositories/PaymentReminderTemplateRepository';
import {
  DEFAULT_PAYMENT_REMINDER_BODY,
  PAYMENT_REMINDER_TEMPLATE_NAME,
  renderPaymentReminderTemplate,
} from '@/contexts/billing/domain/value-objects/paymentReminderTemplate';

class FakeTemplates implements PaymentReminderTemplateRepository {
  public constructor(
    private own: PaymentReminderTemplateContent | null,
    private readonly builtin: PaymentReminderTemplateContent | null,
  ) {}

  public async findOwn(): Promise<PaymentReminderTemplateContent | null> {
    return this.own;
  }

  public async findBuiltin(): Promise<PaymentReminderTemplateContent | null> {
    return this.builtin;
  }

  public async saveOwn(body: string): Promise<void> {
    // El nombre es fijo: se hereda de la integrada o de la constante.
    const name = this.own?.name ?? this.builtin?.name ?? PAYMENT_REMINDER_TEMPLATE_NAME;
    this.own = { name, body };
  }
}

describe('GetPaymentReminderTemplate (v2-spec §6.13)', () => {
  const builtin = { name: 'Recordatorio de pago', body: 'cuerpo integrado' };

  it('prefiere la plantilla propia del profesional', async () => {
    const view = await new GetPaymentReminderTemplate(
      new FakeTemplates({ name: 'Recordatorio de pago', body: 'mi cuerpo' }, builtin),
    ).get();
    expect(view).toEqual({ name: 'Recordatorio de pago', body: 'mi cuerpo', isOwn: true });
  });

  it('cae a la integrada y después al default del módulo puro', async () => {
    expect(await new GetPaymentReminderTemplate(new FakeTemplates(null, builtin)).get()).toEqual({
      name: 'Recordatorio de pago',
      body: 'cuerpo integrado',
      isOwn: false,
    });
    expect(await new GetPaymentReminderTemplate(new FakeTemplates(null, null)).get()).toEqual({
      name: PAYMENT_REMINDER_TEMPLATE_NAME,
      body: DEFAULT_PAYMENT_REMINDER_BODY,
      isOwn: false,
    });
  });
});

describe('UpdatePaymentReminderTemplate', () => {
  it('guarda el contenido sin cambiar el nombre de la plantilla', async () => {
    const templates = new FakeTemplates(null, { name: 'Recordatorio de pago', body: 'base' });
    await new UpdatePaymentReminderTemplate(templates).update(
      new UpdatePaymentReminderTemplateMessage({ body: '  Hola {{paciente}}, debes {{monto}}.  ' }),
    );
    expect(await templates.findOwn()).toEqual({
      name: 'Recordatorio de pago',
      body: 'Hola {{paciente}}, debes {{monto}}.',
    });
  });

  it('rechaza contenidos vacíos o demasiado largos', () => {
    expect(() => new UpdatePaymentReminderTemplateMessage({ body: '   ' })).toThrow();
    expect(() => new UpdatePaymentReminderTemplateMessage({ body: 'x'.repeat(4001) })).toThrow();
  });
});

describe('renderPaymentReminderTemplate', () => {
  it('sustituye todas las variables y limpia líneas sobrantes', () => {
    const rendered = renderPaymentReminderTemplate(
      'Hola {{paciente}} ({{paciente}}), sesión {{fecha}} {{hora}} por {{monto}}.\n\n\n{{politicas}}\n\nLiga: {{liga_pago}} — {{profesional}}',
      {
        paciente: 'Marina',
        profesional: 'Dra. Ana',
        fecha: '12/06/2026',
        hora: '5:00 pm',
        monto: '$ 800.00 MXN',
        liga_pago: 'https://pago.local/b-1',
        politicas: '',
      },
    );
    expect(rendered).toBe(
      'Hola Marina (Marina), sesión 12/06/2026 5:00 pm por $ 800.00 MXN.\n\nLiga: https://pago.local/b-1 — Dra. Ana',
    );
    expect(rendered).not.toContain('{{');
  });
});
