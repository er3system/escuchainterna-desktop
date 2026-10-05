import { describe, it, expect } from 'vitest';
import { Subscription, TRIAL_DAYS } from '@/contexts/identity/domain/Subscription';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Subscription (trial de 7 días)', () => {
  const start = new Date('2026-06-01T12:00:00.000Z');

  it('al registrarse inicia en trial con 7 días', () => {
    const subscription = Subscription.startTrial('sub-1', 'user-1', start);
    expect(subscription.currentStatus()).toBe('trial');
    expect(subscription.isInTrial(start)).toBe(true);
    expect(subscription.daysLeftInTrial(start)).toBe(TRIAL_DAYS);
    expect(subscription.isExpired(start)).toBe(false);
  });

  it('sigue vigente el último día del trial', () => {
    const subscription = Subscription.startTrial('sub-1', 'user-1', start);
    const lastDay = new Date(start.getTime() + 7 * DAY_MS);
    expect(subscription.isExpired(lastDay)).toBe(false);
  });

  it('vence cuando el trial termina sin activarse', () => {
    const subscription = Subscription.startTrial('sub-1', 'user-1', start);
    const afterTrial = new Date(start.getTime() + 7 * DAY_MS + 1);
    expect(subscription.isExpired(afterTrial)).toBe(true);
    expect(subscription.isInTrial(afterTrial)).toBe(false);
    expect(subscription.daysLeftInTrial(afterTrial)).toBe(0);
  });

  it('activate() (pago simulado) la deja activa 30 días y quita el vencimiento', () => {
    const subscription = Subscription.startTrial('sub-1', 'user-1', start);
    const afterTrial = new Date(start.getTime() + 10 * DAY_MS);
    expect(subscription.isExpired(afterTrial)).toBe(true);

    subscription.activate(afterTrial);
    expect(subscription.currentStatus()).toBe('activa');
    expect(subscription.isExpired(afterTrial)).toBe(false);
    const primitives = subscription.toPrimitives();
    expect(primitives.currentPeriodEnd).toBe(new Date(afterTrial.getTime() + 30 * DAY_MS).toISOString());
  });

  it('las cuentas cubiertas (startActive) nunca caen al paywall', () => {
    const subscription = Subscription.startActive('sub-2', 'user-2', start);
    const muchLater = new Date(start.getTime() + 300 * DAY_MS);
    expect(subscription.isExpired(muchLater)).toBe(false);
  });

  it('una suscripción cancelada cuenta como vencida', () => {
    const subscription = Subscription.startActive('sub-3', 'user-3', start);
    subscription.cancel();
    expect(subscription.isExpired(start)).toBe(true);
  });
});
