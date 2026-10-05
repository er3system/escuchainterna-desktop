import { describe, expect, it } from 'vitest';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import { format } from 'date-fns';
import { GetInvoiceMessage } from '@/contexts/billing/application/get-invoice-message/GetInvoiceMessage';
import { SendInvoice } from '@/contexts/billing/application/send-invoice/SendInvoice';
import { SendInvoiceMessage } from '@/contexts/billing/application/send-invoice/SendInvoiceMessage';
import { Invoice } from '@/contexts/billing/domain/Invoice';
import { InvoiceEmail } from '@/contexts/billing/domain/InvoiceEmail';
import { InvoiceEmailSender } from '@/contexts/billing/domain/InvoiceEmailSender';
import { InvoiceForUnpaidBookingError } from '@/contexts/billing/domain/errors/InvoiceForUnpaidBookingError';
import { BookingNotFoundError } from '@/contexts/billing/domain/errors/BookingNotFoundError';
import { BillingProfile, BillingProfileRepository } from '@/contexts/billing/domain/repositories/BillingProfileRepository';
import { InvoiceMessageView, InvoiceRepository } from '@/contexts/billing/domain/repositories/InvoiceRepository';
import { PatientTagsRepository } from '@/contexts/billing/domain/repositories/PatientTagsRepository';
import {
  PaymentsLedger,
  PaymentsLedgerCriteria,
  PaymentsLedgerEntry,
  PaymentsLedgerPage,
} from '@/contexts/billing/domain/repositories/PaymentsLedger';
import { InvoiceFolio } from '@/contexts/billing/domain/value-objects/InvoiceFolio';

function paidEntry(overrides: Partial<PaymentsLedgerEntry> = {}): PaymentsLedgerEntry {
  return {
    bookingId: 'b-1',
    patientId: 'p-1',
    patientName: 'Marina López',
    patientEmail: 'marina@example.com',
    patientPhone: '5512345678',
    patientTags: ['VIP'],
    agendaName: 'Consulta individual',
    agendaColor: '#5e5edb',
    startAt: '2026-06-01T17:00:00.000Z',
    price: 800,
    currency: 'MXN',
    feeCharged: 0,
    feeReason: '',
    chargeAmount: 800,
    bookingStatus: 'completada',
    paymentStatus: 'pagada',
    paymentMethod: 'transferencia',
    paidAt: '2026-06-02T12:00:00.000Z',
    invoiceFolio: null,
    invoiceSentAt: null,
    ...overrides,
  };
}

class FakeLedger implements PaymentsLedger {
  public constructor(private readonly entries: PaymentsLedgerEntry[]) {}

  public async search(_criteria: PaymentsLedgerCriteria): Promise<PaymentsLedgerPage> {
    return { entries: this.entries, collectedByCurrency: [], pendingByCurrency: [] };
  }

  public async findByBookingId(bookingId: string): Promise<PaymentsLedgerEntry | null> {
    return this.entries.find((entry) => entry.bookingId === bookingId) ?? null;
  }

  public async listKnownTags(): Promise<string[]> {
    return [];
  }
}

class FakeProfiles implements BillingProfileRepository {
  public async findCurrent(): Promise<BillingProfile | null> {
    return {
      fullName: 'Dra. Ana Pérez',
      currency: 'MXN',
      paymentPolicies: '',
      autoPaymentReminders: true,
      professionalLicense: '1234567',
      contactAddress: 'Av. Reforma 1, CDMX',
      contactPhone: '5511112222',
      email: 'ana@consultorio.mx',
    };
  }

  public async setAutoPaymentReminders(): Promise<void> {}
}

class FakeInvoices implements InvoiceRepository {
  public saved: Invoice[] = [];
  public constructor(private readonly existingSequences: number[] = []) {}

  public async nextSequenceForYear(_year: number): Promise<number> {
    const max = Math.max(0, ...this.existingSequences, ...this.saved.map((invoice) => sequenceOf(invoice)));
    return max + 1;
  }

  public async save(invoice: Invoice): Promise<void> {
    this.saved.push(invoice);
  }

  public async listMessagesForPatient(): Promise<InvoiceMessageView[]> {
    return [];
  }
}

function sequenceOf(invoice: Invoice): number {
  return Number(invoice.toPrimitives().folio.split('-')[2]);
}

class FakeSender implements InvoiceEmailSender {
  public sent: ReturnType<InvoiceEmail['toPrimitives']>[] = [];

  public async send(email: InvoiceEmail): Promise<string> {
    this.sent.push(email.toPrimitives());
    return `outbox-${this.sent.length}`;
  }
}

class FakeTags implements PatientTagsRepository {
  public constructor(private tags: Map<string, string[]>) {}

  public async findTags(patientId: string): Promise<string[] | null> {
    return this.tags.get(patientId) ?? null;
  }

  public async saveTags(patientId: string, tags: string[]): Promise<void> {
    this.tags.set(patientId, tags);
  }
}

function composeSendInvoice(input: {
  entries: PaymentsLedgerEntry[];
  invoices?: FakeInvoices;
  sender?: FakeSender;
  tags?: FakeTags;
}) {
  const invoices = input.invoices ?? new FakeInvoices();
  const sender = input.sender ?? new FakeSender();
  const tags = input.tags ?? new FakeTags(new Map([['p-1', ['VIP']]]));
  const useCase = new SendInvoice(new FakeLedger(input.entries), new FakeProfiles(), invoices, sender, tags);
  return { useCase, invoices, sender, tags };
}

describe('SendInvoice', () => {
  it('genera folio EI-<año>-<seq>, guarda el recibo y envía el correo por outbox', async () => {
    const { useCase, invoices, sender } = composeSendInvoice({ entries: [paidEntry()] });

    const result = await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));

    const year = new Date().getFullYear();
    expect(result.folio).toBe(`EI-${year}-0001`);
    expect(invoices.saved).toHaveLength(1);
    const primitives = invoices.saved[0].toPrimitives();
    expect(primitives.folio).toBe(`EI-${year}-0001`);
    expect(primitives.outboxMessageId).toBe('outbox-1');
    expect(primitives.amount).toBe(800);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].subject).toContain(`Recibo EI-${year}-0001`);
    expect(sender.sent[0].body).toContain('Cédula profesional: 1234567');
    expect(sender.sent[0].patientEmail).toBe('marina@example.com');
  });

  it('continúa la secuencia del año a partir de las facturas existentes', async () => {
    const { useCase } = composeSendInvoice({
      entries: [paidEntry()],
      invoices: new FakeInvoices([7]),
    });
    const result = await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));
    expect(result.folio).toBe(`EI-${new Date().getFullYear()}-0008`);
  });

  it('añade al paciente la etiqueta automática «Recibo DD/MM/AAAA» sin duplicarla', async () => {
    const tags = new FakeTags(new Map([['p-1', ['VIP']]]));
    const { useCase } = composeSendInvoice({ entries: [paidEntry()], tags });

    await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));
    await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));

    const expectedTag = `Recibo ${format(new Date(), 'dd/MM/yyyy')}`;
    expect(await tags.findTags('p-1')).toEqual(['VIP', expectedTag]);
  });

  it('rechaza facturar una sesión pendiente de pago', async () => {
    const { useCase } = composeSendInvoice({
      entries: [paidEntry({ paymentStatus: 'pendiente', paymentMethod: null, paidAt: null })],
    });
    await expect(useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }))).rejects.toThrow(
      InvoiceForUnpaidBookingError,
    );
  });

  it('rechaza facturar una sesión inexistente (o de otro owner: el ledger no la ve)', async () => {
    const { useCase } = composeSendInvoice({ entries: [] });
    await expect(useCase.send(new SendInvoiceMessage({ bookingId: 'b-ajena' }))).rejects.toThrow(
      BookingNotFoundError,
    );
  });

  it('factura el monto de la tarifa cuando hubo inasistencia', async () => {
    const { useCase, invoices } = composeSendInvoice({
      entries: [
        paidEntry({
          bookingStatus: 'inasistencia',
          feeCharged: 300,
          feeReason: 'inasistencia',
          chargeAmount: 300,
        }),
      ],
    });
    await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));
    expect(invoices.saved[0].toPrimitives().amount).toBe(300);
  });

  // Regresión del bug «moneda del perfil vs moneda de la sesión»: el recibo
  // debe emitirse en la moneda registrada en la sesión (ledger entry), no en
  // la del perfil del profesional. FakeProfiles devuelve currency 'MXN'.
  describe('moneda de la sesión vs moneda del perfil (regresión)', () => {
    it('usa la moneda de la sesión (COP) en el recibo Y en la factura cuando difiere del perfil (MXN)', async () => {
      const { useCase, invoices, sender } = composeSendInvoice({
        entries: [paidEntry({ currency: 'COP' })],
      });

      await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));

      // Invoice persistida: moneda de la sesión, no la del perfil.
      const persisted = invoices.saved[0].toPrimitives();
      expect(persisted.currency).toBe('COP');
      expect(persisted.currency).not.toBe('MXN');

      // Recibo (InvoiceEmail): el monto se formatea con la moneda de la sesión.
      const body = sender.sent[0].body;
      expect(body).toContain(formatMoneyWithCode(800, 'COP'));
      expect(body).not.toContain('MXN');
    });

    it('cae a la moneda del perfil (MXN) cuando la sesión no trae moneda', async () => {
      const { useCase, invoices, sender } = composeSendInvoice({
        entries: [paidEntry({ currency: '' })],
      });

      await useCase.send(new SendInvoiceMessage({ bookingId: 'b-1' }));

      expect(invoices.saved[0].toPrimitives().currency).toBe('MXN');
      expect(sender.sent[0].body).toContain(formatMoneyWithCode(800, 'MXN'));
    });
  });
});

describe('InvoiceFolio', () => {
  it('genera el formato EI-<año>-<secuencia> con relleno de ceros', () => {
    expect(InvoiceFolio.generate(2026, 12).valueOf()).toBe('EI-2026-0012');
    expect(InvoiceFolio.generate(2026, 10000).valueOf()).toBe('EI-2026-10000');
  });

  it('rechaza folios malformados y secuencias inválidas', () => {
    expect(() => InvoiceFolio.fromString('FACT-2026-1')).toThrow();
    expect(() => InvoiceFolio.generate(2026, 0)).toThrow();
  });
});

describe('GetInvoiceMessage', () => {
  const messages: InvoiceMessageView[] = [
    {
      folio: 'EI-2026-0002',
      channel: 'email',
      recipient: 'marina@example.com',
      subject: 'Factura EI-2026-0002',
      body: 'segunda',
      sentAt: '2026-06-10T10:00:00.000Z',
    },
    {
      folio: 'EI-2026-0001',
      channel: 'email',
      recipient: 'marina@example.com',
      subject: 'Factura EI-2026-0001',
      body: 'primera',
      sentAt: '2026-05-02T10:00:00.000Z',
    },
  ];

  const repo: InvoiceRepository = {
    nextSequenceForYear: async () => 1,
    save: async () => {},
    listMessagesForPatient: async () => messages,
  };

  it('resuelve el mensaje cuya fecha coincide con la etiqueta «Recibo DD/MM/AAAA»', async () => {
    const sentLocal = new Date('2026-05-02T10:00:00.000Z');
    const day = String(sentLocal.getDate()).padStart(2, '0');
    const month = String(sentLocal.getMonth() + 1).padStart(2, '0');
    const tag = `Recibo ${day}/${month}/${sentLocal.getFullYear()}`;
    const found = await new GetInvoiceMessage(repo).forPatientTag({ patientId: 'p-1', tag });
    expect(found?.folio).toBe('EI-2026-0001');
  });

  it('acepta la etiqueta legado «Factura DD/MM/AAAA» creada antes del renombrado', async () => {
    const sentLocal = new Date('2026-05-02T10:00:00.000Z');
    const day = String(sentLocal.getDate()).padStart(2, '0');
    const month = String(sentLocal.getMonth() + 1).padStart(2, '0');
    const tag = `Factura ${day}/${month}/${sentLocal.getFullYear()}`;
    const found = await new GetInvoiceMessage(repo).forPatientTag({ patientId: 'p-1', tag });
    expect(found?.folio).toBe('EI-2026-0001');
  });

  it('devuelve la más reciente para la etiqueta genérica «Recibo»', async () => {
    const found = await new GetInvoiceMessage(repo).forPatientTag({ patientId: 'p-1', tag: 'Recibo' });
    expect(found?.folio).toBe('EI-2026-0002');
  });
});
