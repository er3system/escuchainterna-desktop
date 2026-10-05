import type {
  OrganizationInsights,
  OrganizationInsightsReader,
} from '../../domain/repositories/OrganizationInsightsReader';

/** Panel del hub de organización: agregados SQL del equipo, sin contenido clínico. */
export class GetOrganizationInsights {
  public constructor(private readonly reader: OrganizationInsightsReader) {}

  public async get(organizationId: string, now: Date = new Date()): Promise<OrganizationInsights> {
    return this.reader.read(organizationId, now);
  }
}
