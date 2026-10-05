import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RegisterPractitionerMessage } from '@/contexts/identity/application/register-practitioner/RegisterPractitionerMessage';
import {
  applyReferralDiscount,
  parseReferralProgramConfig,
  referralDiscountPercent,
  DEFAULT_REFERRAL_PROGRAM,
} from '@/contexts/identity/domain/value-objects/referralProgram';
import { LEGAL_VERSIONS } from '@/shared/legal/legalVersions';

/**
 * Programa de referidos (v3 §11): código lazy, registro con ?ref, activación
 * al primer pago (con notificación in-app al referente) y descuento aplicado
 * al monto del pago simulado.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-referidos-'));
const dbPath = path.join(tempDir, 'test.db');

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let identity: ReturnType<
  typeof import('@/contexts/identity/infrastructure/createIdentityUseCases')['createIdentityUseCases']
>;
let SqliteReferralRepository: typeof import('@/contexts/identity/infrastructure/persistence/SqliteReferralRepository')['SqliteReferralRepository'];

let referrerId = '';
let referredId = '';

function register(fullName: string, email: string, referralCode = ''): Promise<string> {
  return identity.registerPractitioner.register(
    new RegisterPractitionerMessage({
      fullName,
      email,
      password: 'secreta123',
      phoneDialCode: '+57',
      phoneNumber: '3001234567',
      acceptedTerms: true,
      referralCode,
    }),
  );
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteReferralRepository } = await import(
    '@/contexts/identity/infrastructure/persistence/SqliteReferralRepository'
  ));
  const { createIdentityUseCases } = await import(
    '@/contexts/identity/infrastructure/createIdentityUseCases'
  );
  identity = createIdentityUseCases();

  referrerId = await register('Laura Referente', 'laura.referente@correo.test');
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('referralProgram (módulo puro)', () => {
  it('parsea config con defaults y tolera JSON corrupto', () => {
    expect(parseReferralProgramConfig(null)).toEqual(DEFAULT_REFERRAL_PROGRAM);
    expect(parseReferralProgramConfig('{esto no es json')).toEqual(DEFAULT_REFERRAL_PROGRAM);
    expect(parseReferralProgramConfig('{"descuentoPorcentaje":30}').descuentoPorcentaje).toBe(30);
  });

  it('calcula el descuento topado en maxPorcentaje', () => {
    expect(referralDiscountPercent(0, DEFAULT_REFERRAL_PROGRAM)).toBe(0);
    expect(referralDiscountPercent(2, DEFAULT_REFERRAL_PROGRAM)).toBe(40);
    expect(referralDiscountPercent(9, DEFAULT_REFERRAL_PROGRAM)).toBe(100);
    expect(referralDiscountPercent(3, { descuentoPorcentaje: 20, maxPorcentaje: 50, maxMeses: 12 })).toBe(50);
  });

  it('aplica el descuento al monto', () => {
    expect(applyReferralDiscount(100000, 0)).toBe(100000);
    expect(applyReferralDiscount(100000, 20)).toBe(80000);
    expect(applyReferralDiscount(499, 40)).toBe(299.4);
  });
});

describe('código de referido (lazy)', () => {
  it('se crea al consultarlo por primera vez y es estable', async () => {
    const summary = await identity.getReferralSummary.get(referrerId);
    expect(summary.code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await identity.getReferralSummary.get(referrerId)).code).toBe(summary.code);
    expect(summary.activeCount).toBe(0);
    expect(summary.discountPercent).toBe(0);
  });
});

describe('registro con ?ref', () => {
  it('crea el referral con status registrado', async () => {
    const code = (await identity.getReferralSummary.get(referrerId)).code;
    referredId = await register('Pedro Referido', 'pedro.referido@correo.test', code.toLowerCase());

    const row = getDb()
      .prepare('SELECT referrer_user_id, status FROM referrals WHERE referred_user_id = ?')
      .get(referredId) as { referrer_user_id: string; status: string };
    expect(row.referrer_user_id).toBe(referrerId);
    expect(row.status).toBe('registrado');
    expect((await identity.getReferralSummary.get(referrerId)).registeredCount).toBe(1);
  });

  it('sella la versión de T&C y privacidad aceptadas en el registro (Ley 1581)', () => {
    const row = getDb()
      .prepare('SELECT terms_accepted_at, terms_version, privacy_version FROM users WHERE id = ?')
      .get(referrerId) as {
      terms_accepted_at: string | null;
      terms_version: string | null;
      privacy_version: string | null;
    };
    expect(row.terms_accepted_at).not.toBeNull();
    expect(row.terms_version).toBe(LEGAL_VERSIONS.terms);
    expect(row.privacy_version).toBe(LEGAL_VERSIONS.privacy);
  });

  it('un código inválido no bloquea el registro ni crea referral', async () => {
    const userId = await register('Sin Código', 'sin.codigo@correo.test', 'NOEXISTE9');
    const row = getDb()
      .prepare('SELECT 1 AS x FROM referrals WHERE referred_user_id = ?')
      .get(userId);
    expect(row).toBeUndefined();
  });

  it('ignora auto-referidos a nivel repositorio', async () => {
    await new SqliteReferralRepository().registerReferral(referrerId, referrerId);
    const row = getDb()
      .prepare('SELECT 1 AS x FROM referrals WHERE referred_user_id = ?')
      .get(referrerId);
    expect(row).toBeUndefined();
  });
});

describe('activación del referido (primer pago)', () => {
  it('marca el referral activo y notifica al referente', async () => {
    const result = await identity.activateSubscription.activate(referredId, {
      planId: 'profesional',
      amount: 100000,
      currency: 'COP',
    });
    // El referido no tiene referidos propios: paga precio de lista.
    expect(result.discountPercent).toBe(0);
    expect(result.amountCharged).toBe(100000);

    const referral = getDb()
      .prepare('SELECT status, activated_at FROM referrals WHERE referred_user_id = ?')
      .get(referredId) as { status: string; activated_at: string | null };
    expect(referral.status).toBe('activo');
    expect(referral.activated_at).not.toBeNull();

    const notice = getDb()
      .prepare(
        `SELECT kind, link FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC`,
      )
      .get(referrerId) as { kind: string; link: string };
    expect(notice.kind).toBe('novedad');
    expect(notice.link).toBe('/configuracion/suscripcion');

    expect((await identity.getReferralSummary.get(referrerId)).activeCount).toBe(1);
    expect((await identity.getReferralSummary.get(referrerId)).discountPercent).toBe(20);
  });

  it('una segunda activación no duplica la notificación (idempotente)', async () => {
    await identity.activateSubscription.activate(referredId, { amount: 100000, currency: 'COP' });
    const count = (
      getDb()
        .prepare('SELECT COUNT(*) AS n FROM notifications WHERE recipient_user_id = ?')
        .get(referrerId) as { n: number }
    ).n;
    expect(count).toBe(1);
  });
});

describe('descuento aplicado al pago del referente', () => {
  it('cobra precio × (1 − descuento) y lo registra en subscription_payments', async () => {
    const result = await identity.activateSubscription.activate(referrerId, {
      planId: 'profesional',
      amount: 100000,
      currency: 'COP',
    });
    expect(result.discountPercent).toBe(20);
    expect(result.amountCharged).toBe(80000);

    const payment = getDb()
      .prepare(
        `SELECT sp.amount, sp.currency FROM subscription_payments sp
          JOIN subscriptions s ON s.id = sp.subscription_id
         WHERE s.user_id = ? ORDER BY sp.paid_at DESC`,
      )
      .get(referrerId) as { amount: number; currency: string };
    expect(payment.amount).toBe(80000);
    expect(payment.currency).toBe('COP');
  });

  it('respeta el tope maxPorcentaje configurado por el admin', async () => {
    getDb()
      .prepare(
        `INSERT INTO platform_settings (key, value_json) VALUES ('referral_program', ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
      )
      .run(JSON.stringify({ descuentoPorcentaje: 60, maxPorcentaje: 50, maxMeses: 12 }));

    const result = await identity.activateSubscription.activate(referrerId, {
      amount: 100000,
      currency: 'COP',
    });
    expect(result.discountPercent).toBe(50);
    expect(result.amountCharged).toBe(50000);
  });
});
