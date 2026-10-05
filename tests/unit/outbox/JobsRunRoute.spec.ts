import { describe, it, expect, afterEach } from 'vitest';
import { POST } from '@/app/api/jobs/run/route';

/** Guards de autorización del disparador de jobs (re-plataforma 0f). */

function post(headers?: Record<string, string>): Promise<Response> {
  const request = new Request('http://localhost/api/jobs/run', { method: 'POST', headers });
  return POST(request as unknown as Parameters<typeof POST>[0]);
}

describe('POST /api/jobs/run · autorización', () => {
  afterEach(() => {
    delete process.env.JOBS_SECRET;
  });

  it('503 si JOBS_SECRET no está configurado (endpoint deshabilitado)', async () => {
    delete process.env.JOBS_SECRET;
    const res = await post();
    expect(res.status).toBe(503);
  });

  it('401 sin Bearer correcto', async () => {
    process.env.JOBS_SECRET = 'secreto-de-jobs';
    expect((await post()).status).toBe(401);
    expect((await post({ authorization: 'Bearer incorrecto' })).status).toBe(401);
  });
});
