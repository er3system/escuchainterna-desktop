import { RegisterPractitioner } from '../application/register-practitioner/RegisterPractitioner';
import { LoginUser } from '../application/login-user/LoginUser';
import { RequestPasswordReset } from '../application/request-password-reset/RequestPasswordReset';
import { ResetPassword } from '../application/reset-password/ResetPassword';
import { ChangePassword } from '../application/change-password/ChangePassword';
import { RequestEmailVerification } from '../application/request-email-verification/RequestEmailVerification';
import { VerifyEmail } from '../application/verify-email/VerifyEmail';
import { ActivateSubscription } from '../application/activate-subscription/ActivateSubscription';
import { CancelSubscription } from '../application/cancel-subscription/CancelSubscription';
import { ResumeSubscription } from '../application/resume-subscription/ResumeSubscription';
import { GetSessionContext } from '../application/get-session-context/GetSessionContext';
import { GetOrganizationInsights } from '../application/get-organization-insights/GetOrganizationInsights';
import { GetReferralSummary } from '../application/get-referral-summary/GetReferralSummary';
import { CreateAssistant } from '../application/create-assistant/CreateAssistant';
import { SetAssistantActiveStatus } from '../application/set-assistant-active-status/SetAssistantActiveStatus';
import { CreateReception } from '../application/create-reception/CreateReception';
import { SetReceptionConsultorios } from '../application/set-reception-consultorios/SetReceptionConsultorios';
import { ScryptPasswordHasher } from './ScryptPasswordHasher';
import { SqliteUserAccountRepository } from './persistence/SqliteUserAccountRepository';
import { SqliteSubscriptionRepository } from './persistence/SqliteSubscriptionRepository';
import { SqlitePasswordResetTokenRepository } from './persistence/SqlitePasswordResetTokenRepository';
import { SqliteEmailVerificationTokenRepository } from './persistence/SqliteEmailVerificationTokenRepository';
import { SqliteProfileProvisioner } from './persistence/SqliteProfileProvisioner';
import { SqliteSessionContextReader } from './persistence/SqliteSessionContextReader';
import { SqliteOrganizationInsightsReader } from './persistence/SqliteOrganizationInsightsReader';
import { SqliteAssistantRepository } from './persistence/SqliteAssistantRepository';
import { SqliteReceptionConsultorioRepository } from './persistence/SqliteReceptionConsultorioRepository';
import { SqliteConsultorioRepository } from './persistence/SqliteConsultorioRepository';
import { SqliteOrganizationMembershipRepository } from './persistence/SqliteOrganizationMembershipRepository';
import { SqliteReferralRepository } from './persistence/SqliteReferralRepository';
import { SqlitePlatformSettingsRepository } from './persistence/SqlitePlatformSettingsRepository';
import { OutboxPasswordResetNotifier } from './notifications/OutboxPasswordResetNotifier';
import { OutboxEmailVerificationNotifier } from './notifications/OutboxEmailVerificationNotifier';
import { InAppReferralActivationNotifier } from './notifications/InAppReferralActivationNotifier';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

/** Composición por defecto del contexto identity (adaptadores locales). */
export function createIdentityUseCases() {
  const accounts = new SqliteUserAccountRepository();
  const subscriptions = new SqliteSubscriptionRepository();
  const tokens = new SqlitePasswordResetTokenRepository();
  const emailVerificationTokens = new SqliteEmailVerificationTokenRepository();
  const hasher = new ScryptPasswordHasher();
  const referrals = new SqliteReferralRepository();
  const platformSettings = new SqlitePlatformSettingsRepository();

  return {
    registerPractitioner: new RegisterPractitioner(
      accounts,
      subscriptions,
      new SqliteProfileProvisioner(),
      hasher,
      referrals,
      isDesktopEdition() ? 'local' : 'subscription',
    ),
    loginUser: new LoginUser(accounts, hasher),
    requestPasswordReset: new RequestPasswordReset(accounts, tokens, new OutboxPasswordResetNotifier()),
    resetPassword: new ResetPassword(accounts, tokens, hasher),
    changePassword: new ChangePassword(accounts, hasher),
    requestEmailVerification: new RequestEmailVerification(
      accounts,
      emailVerificationTokens,
      new OutboxEmailVerificationNotifier(),
    ),
    verifyEmail: new VerifyEmail(accounts, emailVerificationTokens),
    activateSubscription: new ActivateSubscription(
      subscriptions,
      referrals,
      platformSettings,
      new InAppReferralActivationNotifier(),
    ),
    cancelSubscription: new CancelSubscription(subscriptions),
    resumeSubscription: new ResumeSubscription(subscriptions),
    getReferralSummary: new GetReferralSummary(referrals, platformSettings),
    getSessionContext: new GetSessionContext(new SqliteSessionContextReader()),
    getOrganizationInsights: new GetOrganizationInsights(new SqliteOrganizationInsightsReader()),
    createAssistant: new CreateAssistant(
      accounts,
      subscriptions,
      new SqliteAssistantRepository(),
      new SqliteProfileProvisioner(),
      hasher,
    ),
    setAssistantActiveStatus: new SetAssistantActiveStatus(accounts, new SqliteAssistantRepository()),
    createReception: new CreateReception(
      accounts,
      subscriptions,
      new SqliteReceptionConsultorioRepository(),
      new SqliteOrganizationMembershipRepository(),
      new SqliteConsultorioRepository(),
      new SqliteProfileProvisioner(),
      hasher,
    ),
    setReceptionConsultorios: new SetReceptionConsultorios(
      new SqliteReceptionConsultorioRepository(),
      new SqliteOrganizationMembershipRepository(),
      new SqliteConsultorioRepository(),
    ),
  };
}
