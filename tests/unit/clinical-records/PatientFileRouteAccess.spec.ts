import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  context: null as null | { userId: string; role: string; isAssistant: boolean },
  findById: vi.fn(),
}));

vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  getActiveAppSessionContext: vi.fn(async () => harness.context),
}));

vi.mock('@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository', () => ({
  SqlitePatientFileRepository: class {
    findById = harness.findById;
  },
}));

vi.mock('@/shared/infrastructure/auth/institutionalCustody', () => ({
  auditCustodyAccess: vi.fn(),
}));

vi.mock('@/contexts/clinical-records/infrastructure/files/getPatientFileStorage', () => ({
  getPatientFileStorage: () => ({ read: vi.fn() }),
}));

import { GET } from '@/app/api/pacientes/[id]/archivos/[fileId]/route';

async function requestFile(): Promise<Response> {
  return GET({} as never, {
    params: Promise.resolve({ id: 'patient-1', fileId: 'file-1' }),
  });
}

describe('patient file route access', () => {
  beforeEach(() => {
    harness.context = null;
    harness.findById.mockReset();
  });

  it('rechaza sesiones ausentes, suspendidas o vencidas antes de consultar archivos', async () => {
    const response = await requestFile();

    expect(response.status).toBe(401);
    expect(harness.findById).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'assistant', isAssistant: true },
    { role: 'professor', isAssistant: false },
  ])('rechaza el rol clinicamente restringido $role', async ({ role, isAssistant }) => {
    harness.context = { userId: 'restricted-1', role, isAssistant };

    const response = await requestFile();

    expect(response.status).toBe(403);
    expect(harness.findById).not.toHaveBeenCalled();
  });
});
