import { MarketingCampaign } from '../../domain/MarketingCampaign';
import { EmailDispatcher } from '../../domain/EmailDispatcher';
import { EmptyCampaignAudienceError } from '../../domain/errors/EmptyCampaignAudienceError';
import { MarketingCampaignRepository } from '../../domain/repositories/MarketingCampaignRepository';
import { RecipientDirectory } from '../../domain/repositories/RecipientDirectory';
import { SendMassEmailMessage } from './SendMassEmailMessage';

export interface MassEmailResult {
  sent: number;
  skippedWithoutEmail: number;
}

export class SendMassEmail {
  public constructor(
    private readonly recipients: RecipientDirectory,
    private readonly campaigns: MarketingCampaignRepository,
    private readonly dispatcher: EmailDispatcher,
  ) {}

  public async send(message: SendMassEmailMessage): Promise<MassEmailResult> {
    const audience = message.isForAllRecipients()
      ? await this.recipients.listAll()
      : await this.recipients.findByIds(message.recipientIdList());
    const reachable = audience.filter((recipient) => recipient.email.trim() !== '');
    if (reachable.length === 0) throw new EmptyCampaignAudienceError();

    // Secuencial (no Promise.all): no reordenar ni saturar el envío.
    for (const recipient of reachable) {
      const variables = {
        nombre: recipient.fullName,
        profesional: message.senderName(),
        ligaAgenda: message.scheduleLink(),
      };
      await this.dispatcher.dispatch({
        template: 'correo_masivo',
        patientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.fullName,
        subject: message.subjectTemplate().render(variables),
        body: message.bodyTemplate().render(variables),
      });
    }

    await this.campaigns.save(
      MarketingCampaign.send(
        message.subjectTemplate().toString(),
        message.bodyTemplate().toString(),
        reachable.map((recipient) => recipient.id),
      ),
    );

    return { sent: reachable.length, skippedWithoutEmail: audience.length - reachable.length };
  }
}
