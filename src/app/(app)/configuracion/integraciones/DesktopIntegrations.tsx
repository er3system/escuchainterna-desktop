import Link from 'next/link';
import { Badge, PageHeader } from '@/components/ui';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';
import { PersonalProviderForm } from './PersonalProviderForm';
const SERVICES = [
  { provider: 'resend' as const, title: 'Correo · Resend', description: 'Envía correos de campañas, facturas y recordatorios desde tu propio remitente.', url: 'https://resend.com/api-keys', guide: 'https://resend.com/docs/dashboard/domains/introduction', steps: 'Crea una cuenta, verifica tu dominio y genera una clave con permiso de envío. Sin clave, los mensajes quedan solo en el registro local.' },
  { provider: 'openai' as const, title: 'Chat · OpenAI', description: 'Activa respuestas generadas por IA en el chat de tu consulta, con el acceso limitado a tus pacientes.', url: 'https://platform.openai.com/api-keys', guide: 'https://developers.openai.com/api/docs/models', steps: 'Activa la facturación de la API, crea una clave e introduce un ID de modelo compatible con Responses. Una suscripción de ChatGPT no sustituye el saldo de API.' },
  { provider: 'anthropic' as const, title: 'Chat y herramientas clínicas · Anthropic', description: 'Activa Claude en el chat, preguntas sobre notas y generación de informes.', url: 'https://console.anthropic.com/settings/keys', guide: 'https://docs.anthropic.com/en/docs/about-claude/models/overview', steps: 'Crea una clave de API, habilita saldo e introduce el ID de un modelo de Claude compatible con Messages.' },
];
export async function DesktopIntegrations({ ownerUserId }: { ownerUserId: string }) {
  const repository = new SqlitePersonalProviderRepository();
  const configs = await Promise.all(SERVICES.map(service => repository.find(ownerUserId, service.provider)));
  return <div><PageHeader title="Servicios opcionales" subtitle="Tu consulta funciona localmente. Conecta tus propias cuentas para añadir servicios por internet." />
    <div className="mb-6 rounded-card border border-line bg-primary-light p-5 text-sm">Agenda, pacientes, expedientes, archivos y registro de pagos funcionan sin claves. Cada servicio externo es opcional y se paga directamente a su proveedor.</div>
    <div className="grid gap-5 xl:grid-cols-2">{SERVICES.map((service, index) => <section key={service.provider} className="rounded-card border border-line bg-surface p-5 shadow-card">
      <Badge tone={configs[index] ? 'success' : 'neutral'}>{configs[index] ? 'Configurada · sin verificar' : 'Introduce tu propia clave'}</Badge>
      <h2 className="mt-3 font-display text-xl font-bold">{service.title}</h2><p className="mt-2 text-sm text-ink-soft">{service.description}</p><p className="mt-3 text-xs leading-relaxed text-ink-soft">{service.steps}</p>
      <div className="mt-3 flex gap-4 text-xs font-medium text-accent-strong"><a href={service.url} target="_blank" rel="noreferrer">Obtener clave ↗</a><a href={service.guide} target="_blank" rel="noreferrer">Guía del proveedor ↗</a></div>
      <PersonalProviderForm provider={service.provider} configured={Boolean(configs[index])} model={configs[index]?.model ?? ''} sender={configs[index]?.sender ?? ''} />
    </section>)}</div>
    <section className="mt-6 rounded-card border border-line bg-surface p-5"><h2 className="font-semibold">Drive y servicios con otros requisitos</h2>
      <p className="mt-3 text-sm text-ink-soft"><Link href="/configuracion/sincronizacion" className="text-accent-strong underline">Google Drive</Link> transporta tus versiones cifradas mediante Drive para escritorio; no requiere una clave API.</p>
      <p className="mt-3 text-sm text-ink-soft">WhatsApp Business de Meta o Twilio requieren número empresarial y plantillas aprobadas; esta versión conserva el registro local y aún no implementa esos adaptadores. <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer" className="text-accent-strong underline">Guía de Meta ↗</a></p>
      <p className="mt-3 text-sm text-ink-soft">Google Calendar y Meet necesitan autorización OAuth. Los pagos automáticos con Stripe, Mercado Pago o PayPal requieren una web pública y webhooks. Sus conexiones no se simulan en esta PC; puedes usar sus sitios directamente y registrar los pagos aquí.</p>
      <p className="mt-3 text-sm text-ink-soft">Los enlaces de reserva, sesión y firma de esta instalación solo se abren en esta PC. Los correos enviados no convierten esos enlaces en páginas públicas. Las automatizaciones se revisan al abrir Marketing; los envíos pendientes se pueden reintentar desde Mensajes.</p>
    </section>
  </div>;
}
