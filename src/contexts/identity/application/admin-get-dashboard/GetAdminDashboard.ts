import type { AdminDashboard, AdminDashboardReader } from '../../domain/repositories/AdminDashboardReader';

/** Dashboard del hub de administración: agregados SQL, sin contenido clínico. */
export class GetAdminDashboard {
  public constructor(private readonly reader: AdminDashboardReader) {}

  public async get(now: Date = new Date()): Promise<AdminDashboard> {
    return await this.reader.read(now);
  }
}
