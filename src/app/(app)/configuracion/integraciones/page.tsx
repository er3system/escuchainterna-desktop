import { CalendarDays, CreditCard, Info, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, PageHeader } from '@/components/ui';
import {
  PAYMENT_GATEWAY_LABELS,
  isGatewayActiveForPatients,
  parsePaymentGatewaySettings,
  type PaymentGatewayProvider,
} from '@/contexts/practitioner/domain/paymentGateways';
import { redactIntegrationSecrets } from '@/contexts/practitioner/domain/integrationCredentials';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import {
  integrationConfigurationRevision,
  listIntegrationConnections,
  type IntegrationProvider,
} from './integrationConnections';
import { IntegrationForm, type IntegrationFieldSpec } from './IntegrationForm';
import { PaymentGatewayForm } from './PaymentGatewayForm';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

interface ProviderMeta {
  provider: IntegrationProvider;
  name: string;
  icon: LucideIcon;
  description: string;
  localNote: string;
  fields: IntegrationFieldSpec[];
}

/**
 * v2 §6.4: solo las pasarelas personales del profesional + Google Calendar.
 * WhatsApp, correo e IA son proveedores de plataforma (/admin/proveedores).
 * Stripe, Mercado Pago y PayPal comparten el flujo de pasarela
 * (PaymentGatewayForm): vinculación "con un clic" en /conectar/[provider]
 * o credenciales manuales; el paciente le paga DIRECTO al profesional con
 * el botón "Paga tu consulta".
 */
const PAYMENT_GATEWAYS_META: Array<{
  provider: PaymentGatewayProvider;
  icon: LucideIcon;
  description: string;
}> = [
  {
    provider: 'stripe',
    icon: CreditCard,
    description:
      'Cobra con tarjeta en línea en todo el mundo; con Adaptive Pricing tus pacientes ven el monto en su propia moneda.',
  },
  {
    provider: 'mercado_pago',
    icon: Landmark,
    description:
      'La opción natural para Hispanoamérica: tarjeta, transferencia o dinero en cuenta de Mercado Pago.',
  },
  {
    provider: 'paypal',
    icon: Wallet,
    description: 'Ideal para pacientes en el extranjero: pagos internacionales con tu cuenta de PayPal.',
  },
];

const OTHER_PROVIDERS_META: ProviderMeta[] = [
  {
    provider: 'google_calendar',
    name: 'Google Calendar y Meet',
    icon: CalendarDays,
    description:
      'Sincroniza tus reservaciones con tu calendario de Google y genera links de reuniones con Google Meet.',
    localNote: 'En modo local los eventos viven solo dentro de la app y los links de Meet son ficticios.',
    fields: [
      { key: 'client_id', label: 'ID de cliente', type: 'text', placeholder: '…apps.googleusercontent.com' },
      { key: 'client_secret', label: 'Secreto de cliente', type: 'password', placeholder: 'GOCSPX-…' },
    ],
  },
];

const STATUS_LABEL: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' }> = {
  desconectado: { label: 'Desconectado', tone: 'neutral' },
  simulado: { label: 'Simulado', tone: 'warning' },
  conectado: { label: 'Conectado', tone: 'success' },
};

export default async function IntegracionesPage() {
  const connections = await listIntegrationConnections(await requireClinicalConfigAccess());
  if (isDesktopEdition()) {
    return (
      <div>
        <PageHeader title="Integraciones · Edición PC" subtitle="La consulta funciona sin internet. Los servicios externos se configuran por separado." />
        <div className="mb-6 rounded-card border border-line bg-primary-light p-5 text-sm text-ink">
          Las cuentas empresariales de la plataforma web no están incluidas en esta instalación. Los enlaces de reserva, sesión y firma se abren únicamente desde esta PC.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: 'Pagos', text: 'Registra pagos, tarifas y saldos de tus pacientes manualmente. Esta instalación no procesa cobros en línea.' },
            { title: 'Correo y WhatsApp', text: 'Los mensajes sin proveedor quedan registrados localmente; no se entregan al destinatario. El envío requiere un proveedor y credenciales propios.' },
            { title: 'Calendario y videollamadas', text: 'La agenda es local. Esta edición no configura una cuenta real de Google ni genera reuniones remotas mediante una simulación.' },
            { title: 'Asistente', text: 'El modo local organiza la información registrada. Para análisis con IA remota se necesita un proveedor configurado, internet y autorización para tratar los datos clínicos.' },
          ].map(({ title, text }) => (
            <section key={title} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <Badge tone="neutral">Local</Badge><h2 className="mt-3 font-semibold text-ink">{title}</h2><p className="mt-2 text-sm text-ink-soft">{text}</p>
            </section>
          ))}
        </div>
      </div>
    );
  }
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));

  return (
    <div>
      <PageHeader
        title="Integraciones"
        subtitle="Conecta tus métodos de cobro y tu calendario. Las credenciales se guardan cifradas y nunca vuelven a mostrarse."
      />

      <div className="mb-6 flex items-start gap-2 rounded-card border border-line bg-primary-light px-4 py-3 text-sm text-ink">
        <Info size={16} className="mt-0.5 shrink-0 text-primary" />
        <p>
          Los recordatorios de WhatsApp y correo se envían desde la cuenta empresarial de EscuchaInterna; tú solo
          conectas tus métodos de cobro. Mientras una integración esté desconectada se usa su adaptador local (
          <span className="font-medium">Modo local</span>) y la app funciona 100 % sin conexión.
        </p>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Pasarelas de cobro</h2>
      <div className="space-y-4">
        {PAYMENT_GATEWAYS_META.map((meta) => {
          const connection = byProvider.get(meta.provider);
          const safeConfig = redactIntegrationSecrets(connection?.config ?? {});
          const settings = parsePaymentGatewaySettings(meta.provider, connection?.config ?? {});
          const ready = settings.configured && connection?.status !== 'desconectado';
          const Icon = meta.icon;
          const gatewayName = PAYMENT_GATEWAY_LABELS[meta.provider];
          return (
            <div key={meta.provider} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{gatewayName}</h3>
                      {ready ? (
                        <Badge tone="success">
                          {settings.linkedAccountId ? 'Cuenta vinculada — modo local' : 'Lista — modo local'}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Deshabilitada</Badge>
                      )}
                      {ready && isGatewayActiveForPatients(settings) ? (
                        <Badge tone="primary">Botón de pago visible</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-ink-soft">{meta.description}</p>
                    <p className="mt-1.5 flex max-w-2xl items-start gap-1.5 text-xs font-medium text-ink">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
                      Tus pacientes te pagan directo a tu cuenta de {gatewayName}; EscuchaInterna no toca tu dinero.
                    </p>
                    {ready ? (
                      <p className="mt-0.5 max-w-2xl text-xs text-ink-soft">
                        Configurada en modo local: el pago se simula en la página de la sesión. En producción tus
                        pacientes serán redirigidos al checkout real de {gatewayName}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <PaymentGatewayForm
                provider={meta.provider}
                currentConfig={safeConfig}
                configurationRevision={integrationConfigurationRevision(connection)}
              />
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-soft">Otras integraciones</h2>
      <div className="space-y-4">
        {OTHER_PROVIDERS_META.map((meta) => {
          const connection = byProvider.get(meta.provider);
          const safeConfig = redactIntegrationSecrets(connection?.config ?? {});
          const status = STATUS_LABEL[connection?.status ?? 'desconectado'] ?? STATUS_LABEL.desconectado;
          const Icon = meta.icon;
          return (
            <div key={meta.provider} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{meta.name}</h3>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Badge tone="neutral">Modo local</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-ink-soft">{meta.description}</p>
                    <p className="mt-0.5 max-w-2xl text-xs text-ink-soft">{meta.localNote}</p>
                  </div>
                </div>
              </div>
              <IntegrationForm
                provider={meta.provider}
                fields={meta.fields}
                currentConfig={safeConfig}
                connected={connection?.status === 'conectado'}
                configurationRevision={integrationConfigurationRevision(connection)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
