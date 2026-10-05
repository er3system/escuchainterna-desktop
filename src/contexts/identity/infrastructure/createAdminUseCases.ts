import { ActivateSubscription } from '../application/activate-subscription/ActivateSubscription';
import { RequestPasswordReset } from '../application/request-password-reset/RequestPasswordReset';
import { GetAdminDashboard } from '../application/admin-get-dashboard/GetAdminDashboard';
import { AdminCreateUser } from '../application/admin-create-user/AdminCreateUser';
import { AdminSetUserStatus } from '../application/admin-set-user-status/AdminSetUserStatus';
import { AdminExtendTrial } from '../application/admin-extend-trial/AdminExtendTrial';
import { AdminActivateUserSubscription } from '../application/admin-activate-user-subscription/AdminActivateUserSubscription';
import { AdminResetUserPassword } from '../application/admin-reset-user-password/AdminResetUserPassword';
import { AdminUnlockLogin } from '../application/admin-unlock-login/AdminUnlockLogin';
import { AdminDisableUserTotp } from '../application/admin-disable-totp/AdminDisableUserTotp';
import { AdminUpdateUser } from '../application/admin-update-user/AdminUpdateUser';
import { AdminSetUserLimits } from '../application/admin-set-user-limits/AdminSetUserLimits';
import { AdminUpsertOrganization } from '../application/admin-upsert-organization/AdminUpsertOrganization';
import { AdminSavePermissionPresets } from '../application/admin-save-permission-presets/AdminSavePermissionPresets';
import { AdminConfigureProvider } from '../application/admin-configure-provider/AdminConfigureProvider';
import { ScryptPasswordHasher } from './ScryptPasswordHasher';
import { SqliteUserAccountRepository } from './persistence/SqliteUserAccountRepository';
import { SqliteSubscriptionRepository } from './persistence/SqliteSubscriptionRepository';
import { SqliteOrganizationRepository } from './persistence/SqliteOrganizationRepository';
import { SqliteOrganizationMembershipRepository } from './persistence/SqliteOrganizationMembershipRepository';
import { SqlitePasswordResetTokenRepository } from './persistence/SqlitePasswordResetTokenRepository';
import { SqliteProfileProvisioner } from './persistence/SqliteProfileProvisioner';
import { SqliteAdminAuditLogRepository } from './persistence/SqliteAdminAuditLogRepository';
import { SqlitePlatformSettingsRepository } from './persistence/SqlitePlatformSettingsRepository';
import { SqliteAdminDashboardReader } from './persistence/SqliteAdminDashboardReader';
import { SqliteAdminDirectoryReader } from './persistence/SqliteAdminDirectoryReader';
import { OutboxPasswordResetNotifier } from './notifications/OutboxPasswordResetNotifier';

/** Composición de los casos de uso del hub de administración (/admin). */
export function createAdminUseCases() {
  const accounts = new SqliteUserAccountRepository();
  const subscriptions = new SqliteSubscriptionRepository();
  const organizations = new SqliteOrganizationRepository();
  const memberships = new SqliteOrganizationMembershipRepository();
  const settings = new SqlitePlatformSettingsRepository();
  const audit = new SqliteAdminAuditLogRepository();
  const hasher = new ScryptPasswordHasher();
  const profiles = new SqliteProfileProvisioner();

  return {
    audit,
    settings,
    directory: new SqliteAdminDirectoryReader(),
    getDashboard: new GetAdminDashboard(new SqliteAdminDashboardReader(audit)),
    createUser: new AdminCreateUser(
      accounts,
      subscriptions,
      organizations,
      memberships,
      profiles,
      hasher,
      audit,
    ),
    setUserStatus: new AdminSetUserStatus(accounts, audit),
    extendTrial: new AdminExtendTrial(subscriptions, audit),
    activateUserSubscription: new AdminActivateUserSubscription(
      new ActivateSubscription(subscriptions),
      accounts,
      audit,
    ),
    resetUserPassword: new AdminResetUserPassword(
      new RequestPasswordReset(accounts, new SqlitePasswordResetTokenRepository(), new OutboxPasswordResetNotifier()),
      accounts,
      audit,
    ),
    unlockLogin: new AdminUnlockLogin(accounts, audit),
    disableUserTotp: new AdminDisableUserTotp(accounts, audit),
    updateUser: new AdminUpdateUser(accounts, profiles, audit),
    setUserLimits: new AdminSetUserLimits(accounts, audit),
    upsertOrganization: new AdminUpsertOrganization(organizations, memberships, accounts, audit),
    savePermissionPresets: new AdminSavePermissionPresets(settings, audit),
    configureProvider: new AdminConfigureProvider(settings, audit),
  };
}
