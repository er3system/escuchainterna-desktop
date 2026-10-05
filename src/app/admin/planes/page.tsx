import { Info } from 'lucide-react';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { ensureDefaultWaMonthlyLimits } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { SqlitePlatformSettingsRepository } from '@/contexts/identity/infrastructure/persistence/SqlitePlatformSettingsRepository';
import {
  parseReferralProgramConfig,
  REFERRAL_PROGRAM_SETTINGS_KEY,
} from '@/contexts/identity/domain/value-objects/referralProgram';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { PlanEditCard, type EditablePlan } from './PlanEditCard';
import { ReferralProgramCard } from './ReferralProgramCard';

export const metadata = { title: 'Planes · Administración · EscuchaInterna' };

/** Límite de WhatsApp por plan (el PlanCatalog compartido no expone esta columna). */
async function readWaMonthlyLimits(): Promise<Map<string, number | null>> {
  const rows = await getDatabaseAdapter().query<{ id: string; wa_monthly_limit: number | null }>(
    'SELECT id, wa_monthly_limit FROM plans',
  );
  return new Map(rows.map((row) => [row.id, row.wa_monthly_limit]));
}

export default async function AdminPlanesPage() {
  await requireAdmin();
  await ensureDefaultWaMonthlyLimits();

  const waLimits = await readWaMonthlyLimits();
  const referralProgramConfig = parseReferralProgramConfig(
    await new SqlitePlatformSettingsRepository().get(REFERRAL_PROGRAM_SETTINGS_KEY),
  );
  const plans: EditablePlan[] = (await listPlans()).map((plan) => ({
    id: plan.id,
    name: plan.name,
    prices: plan.prices,
    aiMonthlyBudgetCop: plan.aiMonthlyBudgetCop,
    aiSoftBudgetCop: plan.aiSoftBudgetCop,
    waMonthlyLimit: waLimits.get(plan.id) ?? null,
    features: plan.features,
    highlighted: plan.highlighted,
  }));

  return (
    <div>
      <PageHeader
        title="Planes"
        subtitle="Precios de lista por moneda y presupuestos de IA de cada plan — los cambios se reflejan en la landing y el paywall"
      />

      <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-primary-light/60 dark:bg-primary/20 p-4">
        <Info size={18} className="mt-0.5 shrink-0 text-primary dark:text-accent-2" />
        <p className="text-sm text-ink">
          Los precios son de <strong>lista por moneda de display</strong> (marketing, no conversión cambiaria
          exacta); la moneda por defecto del producto es <strong>COP</strong> y su precio es obligatorio. Los
          presupuestos de IA se miden en COP: el tope duro corta el uso del mes y el umbral suave cambia al
          modelo económico. El límite de WhatsApp es mensual por profesional: al alcanzarlo los avisos salen
          solo por correo (el WhatsApp queda registrado como omitido).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {plans.map((plan) => (
          <PlanEditCard key={plan.id} plan={plan} />
        ))}

        {/* Programa de referidos (v3 §11): config global de la plataforma. */}
        <ReferralProgramCard config={referralProgramConfig} />
      </div>
    </div>
  );
}
