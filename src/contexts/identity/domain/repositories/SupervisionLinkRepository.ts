import { SupervisionLink } from '../SupervisionLink';

export interface SupervisionLinkRepository {
  save(link: SupervisionLink): Promise<void>;
  listBySupervisor(supervisorUserId: string): Promise<SupervisionLink[]>;
  supervisesAnyone(supervisorUserId: string): Promise<boolean>;
}
