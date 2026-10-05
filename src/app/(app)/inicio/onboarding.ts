import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { SqliteUserPreferencesRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteUserPreferencesRepository';
import { readCompletedTutorials } from '../ayuda/helpProgress';

/**
 * Checklist de "primeros pasos" del inicio. Cada paso se marca SOLO con datos
 * reales (perfil, disponibilidad, pacientes, sesiones, tutoriales) — no es un
 * estado aparte que se pueda desincronizar. Solo servidor (toca la BD).
 */

export const ONBOARDING_DISMISSED_KEY = 'onboarding_dismissed';

export interface OnboardingStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  allDone: boolean;
}

async function hasRow(table: string, userId: string): Promise<boolean> {
  return Boolean(
    await getDatabaseAdapter().queryRow(`SELECT 1 FROM ${table} WHERE owner_user_id = ? LIMIT 1`, [userId]),
  );
}

export async function isOnboardingDismissed(userId: string): Promise<boolean> {
  return (await new SqliteUserPreferencesRepository(userId).get(ONBOARDING_DISMISSED_KEY)) === '1';
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(userId);
  const hasProfile = Boolean(
    profile &&
      ((profile.professionalLicense ?? '').trim() !== '' ||
        Boolean(profile.photoPath) ||
        (profile.description ?? '').trim() !== ''),
  );
  const hasAvailability = Boolean(profile && (profile.availability?.length ?? 0) > 0);
  const hasPatient = await hasRow('patients', userId);
  const hasActivity = (await hasRow('session_notes', userId)) || (await hasRow('bookings', userId));
  const hasTutorial = (await readCompletedTutorials(userId)).length > 0;

  const steps: OnboardingStep[] = [
    {
      key: 'perfil',
      label: 'Completa tu perfil',
      hint: 'Foto, descripción, tarifas y tu tarjeta profesional.',
      href: '/configuracion/perfil',
      cta: 'Ir al perfil',
      done: hasProfile,
    },
    {
      key: 'agenda',
      label: 'Define tu disponibilidad',
      hint: 'Los días y horas en que recibes pacientes.',
      href: '/agenda/configuracion',
      cta: 'Configurar agenda',
      done: hasAvailability,
    },
    {
      key: 'paciente',
      label: 'Registra tu primer paciente',
      hint: 'Para abrir su expediente y agendarle.',
      href: '/pacientes/nuevo',
      cta: 'Crear paciente',
      done: hasPatient,
    },
    {
      key: 'sesion',
      label: 'Agenda o registra una sesión',
      hint: 'Empieza a llevar la evolución de tu trabajo.',
      href: '/agenda',
      cta: 'Ir a la agenda',
      done: hasActivity,
    },
    {
      key: 'tutorial',
      label: 'Mira un tutorial',
      hint: 'Un minuto para conocer cada parte de la app.',
      href: '/ayuda',
      cta: 'Ver tutoriales',
      done: hasTutorial,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, total: steps.length, allDone: doneCount === steps.length };
}
