import { Consultorio } from '../Consultorio';

export interface ConsultorioRepository {
  save(consultorio: Consultorio): Promise<void>;
  findById(id: string): Promise<Consultorio | null>;
  /** Solo consultorios NO archivados de la org, ordenados por created_at ASC. */
  listByOrganization(organizationId: string): Promise<Consultorio[]>;
  /** Consultorio por id ACOTADO a su organización (null si no es de esa org). */
  findByIdInOrganization(id: string, organizationId: string): Promise<Consultorio | null>;
}
