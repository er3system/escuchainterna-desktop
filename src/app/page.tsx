import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { DesktopHome } from '@/components/DesktopHome';
import { OpenSourceShowcase } from '@/components/showcase/OpenSourceShowcase';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';

export function generateMetadata(): Metadata {
  if (isDesktopEdition()) return {
    title: 'EscuchaInterna para PC — Tu consulta en tu equipo',
    description: 'Aplicación local de código abierto para organizar la consulta, con cuentas propias y sin suscripción.',
  };
  const title = 'EscuchaInterna — Gestión de consulta para Windows';
  const description = 'Tu consulta, tu espacio. Agenda, expedientes y consentimientos en tu PC. EscuchaInterna es gratuito, funciona sin conexión y comparte su código con licencia MIT.';
  return {
    title, description,
    alternates: { canonical: 'https://escuchainterna.com' },
    openGraph: { title, description, url: 'https://escuchainterna.com', siteName: 'EscuchaInterna', locale: 'es_ES', type: 'website', images: [{ url: 'https://escuchainterna.com/showcase/social.png', width: 1200, height: 630, alt: 'EscuchaInterna: gestión de consulta para Windows' }] },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Home() {
  // La portada pública no consulta cuentas, expedientes ni la base operativa.
  if (!isDesktopEdition()) return <OpenSourceShowcase />;
  const userId = await getSessionUserId();
  if (userId) {
    const context = await createIdentityUseCases().getSessionContext.get(userId);
    if (context && context.status !== 'suspendido') {
      const profile = await new SqlitePractitionerProfileRepository().findByUserId(userId);
      redirect(context.isReception ? '/recepcion' : homePathForRole(context.role, profile?.onboardingCompleted ?? false));
    }
  }
  return <DesktopHome authenticated={false} />;
}
