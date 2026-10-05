import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { OrgNav } from './OrgNav';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

/**
 * Hub de organización: misma carcasa (sidebar) que la app privada, con guard
 * de rol org_master. El profesor también entra (v3 §12), pero SOLO para la
 * página de Avisos a sus supervisados — el resto de secciones lo regresa el
 * guard requireOrgMaster de cada página.
 */
export default async function OrganizacionLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');
  if (!isDesktopEdition() && context.subscription?.expired) redirect('/suscripcion');
  if (context.role !== 'org_master' && context.role !== 'professor') {
    redirect(homePathForRole(context.role, context.onboardingCompleted));
  }

  const trialDaysLeft =
    !isDesktopEdition() && context.subscription && context.subscription.status === 'trial'
      ? context.subscription.daysLeftInTrial
      : null;

  const unreadNotifications = await createNotificationUseCases().countUnread.count(userId);
  // El tema lo fija .dark en <body> (RootLayout, por cookie); aquí solo se lee para el initialDark
  // del ThemeToggle que trae el Sidebar (estado inicial del ícono).
  const dark = (await cookies()).get('ei-theme')?.value === 'dark';

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        initialDark={dark}
        desktopEdition={isDesktopEdition()}
        role={context.role}
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
      />
      <main className="min-h-screen px-4 pb-6 pt-[4.5rem] md:ml-60 md:px-8 md:pt-6">
        <ImpersonationBanner />
        <OrgNav viewerRole={context.role === 'professor' ? 'professor' : 'org_master'} />
        {children}
      </main>
    </div>
  );
}
