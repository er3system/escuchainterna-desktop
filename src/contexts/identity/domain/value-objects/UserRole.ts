/** Roles de plataforma (users.role). Módulo puro: sin dependencias de Node. */
export type UserRole = 'admin' | 'org_master' | 'professor' | 'psychologist' | 'assistant';

export const USER_ROLES: UserRole[] = ['admin', 'org_master', 'professor', 'psychologist', 'assistant'];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as string[]).includes(value);
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administración de la plataforma',
  org_master: 'Perfil maestro de organización',
  professor: 'Supervisión académica',
  psychologist: 'Psicólogo/a',
  assistant: 'Asistente / recepción',
};

/** Ruta de aterrizaje tras iniciar sesión, según el rol. */
export function homePathForRole(role: UserRole, onboardingCompleted: boolean): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'org_master':
      return '/organizacion';
    case 'professor':
      return '/supervision';
    case 'assistant':
      // El asistente trabaja sobre la agenda del titular; no pasa por onboarding.
      return '/agenda';
    default:
      return onboardingCompleted ? '/inicio' : '/onboarding';
  }
}
