import { PatientNotFoundError } from '../../domain/errors/PatientNotFoundError';
import { PatientTagsRepository } from '../../domain/repositories/PatientTagsRepository';
import { UpdatePatientTagsMessage } from './UpdatePatientTagsMessage';

export class UpdatePatientTags {
  public constructor(private readonly patientTags: PatientTagsRepository) {}

  public async update(message: UpdatePatientTagsMessage): Promise<void> {
    const current = await this.patientTags.findTags(message.patientId());
    if (current === null) throw new PatientNotFoundError(message.patientId());
    await this.patientTags.saveTags(message.patientId(), message.tags());
  }
}
