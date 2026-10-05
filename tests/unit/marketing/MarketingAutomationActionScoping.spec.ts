import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  repositoryOwners: [] as string[],
  update: vi.fn(),
  revalidatePath: vi.fn(),
  forbidProfessorRole: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  forbidAssistantRole: vi.fn(async () => 'marketing-action-owner'),
  forbidProfessorRole: harness.forbidProfessorRole,
}));
vi.mock(
  '@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository',
  () => ({
    SqliteMarketingAutomationRepository: class {
      public constructor(ownerUserId: string) {
        harness.repositoryOwners.push(ownerUserId);
      }
    },
  }),
);
vi.mock('@/contexts/marketing/application/update-automation/UpdateAutomation', () => ({
  UpdateAutomation: class {
    public async update(message: unknown): Promise<void> {
      await harness.update(message);
    }
  },
}));

import { updateAutomationAction } from '@/app/(app)/marketing/actions';

describe('updateAutomationAction · scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.repositoryOwners.length = 0;
    harness.update.mockResolvedValue(undefined);
    harness.forbidProfessorRole.mockResolvedValue('marketing-action-owner');
  });

  it('construye el repositorio con el owner resuelto en el servidor', async () => {
    const formData = new FormData();
    formData.set('tipo', 'cumpleanios');
    formData.set('activa', '1');
    formData.set('asunto', 'Feliz cumpleaños');
    formData.set('mensaje', 'Hola {{nombre}}');

    const result = await updateAutomationAction({}, formData);

    expect(result).toEqual({ ok: 'Se guardó la automatización.' });
    expect(harness.forbidProfessorRole).toHaveBeenCalledOnce();
    expect(harness.repositoryOwners).toEqual(['marketing-action-owner']);
    expect(harness.update).toHaveBeenCalledOnce();
    expect(harness.revalidatePath).toHaveBeenCalledWith('/marketing');
  });
});
