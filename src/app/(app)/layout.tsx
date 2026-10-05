import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AssistantLauncher } from '@/components/AssistantLauncher';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { DesktopStatusBanner } from '@/components/DesktopStatusBanner';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const desktopEdition = isDesktopEdition();
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');

  // Gate del trial: vencido y sin suscripción activa → paywall.
  if (!desktopEdition && context.subscription?.expired) redirect('/suscripcion');

  const trialDaysLeft =
    !desktopEdition && context.subscription && context.subscription.status === 'trial'
      ? context.subscription.daysLeftInTrial
      : null;

  // Campana (v3 §12): contador inicial; el feed se carga al abrirla.
  const unreadNotifications = await createNotificationUseCases().countUnread.count(userId);

  // Verificación de correo (doble opt-in, NO bloqueante): si la cuenta aún no
  // confirma su correo se muestra un banner. Consulta ligera directa (no es clínico).
  const verifiedRow = (await getDatabaseAdapter().queryRow(
    'SELECT email_verified_at FROM users WHERE id = ?',
    [userId],
  )) as { email_verified_at: string | null } | null;
  const emailUnverified = !!verifiedRow && verifiedRow.email_verified_at === null;

  // Tema oscuro: la clase .dark vive en <body> (RootLayout, por cookie) y es la única fuente del
  // tema → cubre esta área y los toasts/portales (que cuelgan de body). Aquí solo se lee la cookie
  // para pasar `initialDark` al ThemeToggle del Sidebar (estado inicial del ícono, sin FOUC).
  const dark = (await cookies()).get('ei-theme')?.value === 'dark';

  return (
    <div id="app-shell">
    <ToastProvider>
    <div className="min-h-screen bg-bg">
      <Sidebar
        role={context.isReception ? 'reception' : context.role}
        paymentsDisabled={context.permissions.paymentsDisabled || !context.permissions.canCharge}
        isSupervisor={context.isSupervisor}
        organization={
          context.organization
            ? {
                id: context.organization.id,
                name: context.organization.name,
                hasLogo: Boolean(context.organization.logoPath),
              }
            : null
        }
        trialDaysLeft={trialDaysLeft}
        unreadNotifications={unreadNotifications}
        initialDark={dark}
        desktopEdition={desktopEdition}
      />
      <main className="min-h-screen px-4 pb-6 pt-[4.5rem] md:ml-60 md:px-8 md:pt-6">
        <ImpersonationBanner />
        {desktopEdition ? <DesktopStatusBanner /> : emailUnverified ? <EmailVerificationBanner /> : null}
        {children}
      </main>
      {/* El Asistente IA queda fuera del alcance del rol asistente (v3 §4) y del
          profesor (supervisa, no atiende; pisa este layout en biblioteca y
          configuración — sin este gate veía el botón flotante del asistente). */}
      {context.isAssistant || context.role === 'professor' ? null : <AssistantLauncher />}
    </div>
    </ToastProvider>
    </div>
  );
}
