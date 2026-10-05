import { SqliteUserPreferencesRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteUserPreferencesRepository';

/**
 * Progreso de los tutoriales de Ayuda por USUARIO (cada quien el suyo, no por
 * dueño de datos). Se guarda como un arreglo JSON de ids en `user_preferences`.
 * Solo servidor (toca la BD); no importar desde un client component.
 */

const KEY = 'help_completed';

export async function readCompletedTutorials(userId: string): Promise<string[]> {
  const raw = await new SqliteUserPreferencesRepository(userId).get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export async function addCompletedTutorial(userId: string, tutorialId: string): Promise<void> {
  const current = await readCompletedTutorials(userId);
  if (current.includes(tutorialId)) return;
  current.push(tutorialId);
  await new SqliteUserPreferencesRepository(userId).set(KEY, JSON.stringify(current));
}
