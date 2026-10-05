import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { EchoDivider } from '@/components/landing/Echo';
import { Features } from '@/components/landing/Features';
import { StatRow } from '@/components/landing/StatRow';
import { EarlyVoices } from '@/components/landing/EarlyVoices';
import { Manifesto } from '@/components/landing/Manifesto';
import { Origen } from '@/components/landing/Origen';
import { Resources } from '@/components/landing/Resources';
import { B2B } from '@/components/landing/B2B';
import { OrgSeatCalculator } from '@/components/landing/OrgSeatCalculator';
import { Pricing } from '@/components/landing/Pricing';
import { Faq } from '@/components/landing/Faq';
import { Privacy } from '@/components/landing/Privacy';
import { FinalCta } from '@/components/landing/FinalCta';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Reveal } from '@/components/landing/Reveal';
import { Panel } from '@/components/landing/Panel';
import { GsapProvider } from '@/components/landing/motion/GsapProvider';
import { LivingBackground } from '@/components/landing/LivingBackground';
import { ProductInVivo } from '@/components/landing/ProductInVivo';
import { PrelaunchBanner } from '@/components/landing/PrelaunchBanner';
import { DesktopHome } from '@/components/DesktopHome';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';

const WEB_METADATA: Metadata = {
  title: 'EscuchaInterna — El todo-en-uno para potenciar tu práctica como psicólogo',
  description:
    'Agenda inteligente, expediente clínico con CIE-11, recordatorios por WhatsApp, pagos y asistente de IA. Prueba gratis 7 días, sin tarjeta.',
};

export function generateMetadata(): Metadata {
  return isDesktopEdition() ? {
    title: 'EscuchaInterna para PC — Tu consulta en tu equipo',
    description: 'Aplicación local de código abierto para organizar la consulta, con cuentas propias y sin suscripción.',
  } : WEB_METADATA;
}

export default async function Home() {
  const userId = await getSessionUserId();
  if (isDesktopEdition()) {
    if (userId) {
      const context = await createIdentityUseCases().getSessionContext.get(userId);
      if (context && context.status !== 'suspendido') {
        const profile = await new SqlitePractitionerProfileRepository().findByUserId(userId);
        redirect(context.isReception ? '/recepcion' : homePathForRole(context.role, profile?.onboardingCompleted ?? false));
      }
    }
    return <DesktopHome authenticated={false} />;
  }
  const dark = (await cookies()).get('ei-theme')?.value === 'dark';

  return (
    <div className="relative text-ink">
      {/* Fondo VIVO: la onda Reverberación + aurora salvia en movimiento continuo.
          El raíz queda transparente (el papel lo pone el body en globals) para que
          este fondo fijo a -z-10 se vea detrás del contenido. */}
      <LivingBackground />
      {/* Granulado estético sobre toda la página (decorativo). */}
      <div
        aria-hidden="true"
        className="grain-overlay pointer-events-none fixed inset-0 z-[60] opacity-[0.05]"
      />
      {/* Aviso de pre-lanzamiento + captura de correo para el boletín de avances. */}
      <PrelaunchBanner />
      <LandingNav isAuthenticated={Boolean(userId)} initialDark={dark} />
      {/* GsapProvider registra GSAP una vez y arma la coreografía solo si no se pide
          menos movimiento. Las secciones "flotan" como paneles sobre el lienzo. */}
      <GsapProvider>
        <main className="space-y-5 py-5 sm:space-y-8 sm:py-8">
          <Hero />
          <Panel tone="cream">
            <Features />
          </Panel>
          <Panel tone="ink">
            <StatRow />
          </Panel>
          {/* PIEZA FIRMA: el producto se demuestra solo al hacer scroll (scrollytelling). */}
          <ProductInVivo />
          <Panel tone="cream">
            <Reveal dir="scale">
              <Manifesto />
            </Reveal>
          </Panel>
          <Panel tone="cream">
            <Reveal>
              <Origen />
            </Reveal>
          </Panel>
          {/* Voces tempranas: franja vertical, a sangre completa sobre el lienzo. */}
          <Reveal>
            <EarlyVoices />
          </Reveal>
          <Panel tone="cream">
            <Reveal>
              <Resources />
            </Reveal>
          </Panel>
          <Panel tone="ink">
            <Reveal dir="scale">
              <B2B />
            </Reveal>
          </Panel>
          <Panel tone="cream">
            <Reveal>
              <OrgSeatCalculator />
            </Reveal>
          </Panel>
          <Panel tone="cream">
            <Reveal dir="scale">
              <Pricing />
            </Reveal>
          </Panel>
          <EchoDivider className="mx-auto max-w-6xl px-6 py-2" />
          <Panel tone="cream">
            <Reveal>
              <Faq />
            </Reveal>
          </Panel>
          <Panel tone="cream">
            <Reveal>
              <Privacy />
            </Reveal>
          </Panel>
          <FinalCta />
        </main>
      </GsapProvider>
      <LandingFooter />
    </div>
  );
}
