import { subMonths } from 'date-fns';
import { MarketingAutomation } from '../../domain/MarketingAutomation';
import { EmailDispatcher } from '../../domain/EmailDispatcher';
import { AutomationDeliveryLog } from '../../domain/repositories/AutomationDeliveryLog';
import { MarketingAutomationRepository } from '../../domain/repositories/MarketingAutomationRepository';
import { MessageTemplateOverrideRepository } from '../../domain/repositories/MessageTemplateOverrideRepository';
import { MarketingRecipient, RecipientDirectory } from '../../domain/repositories/RecipientDirectory';
import { renderTemplateContent } from '../../domain/value-objects/messageTemplateCatalog';

export interface DueAutomationsResult {
  birthdayGreetings: number;
  reactivations: number;
}

/**
 * Ejecuta las automatizaciones pendientes. Es idempotente: antes de cada envío
 * consulta el registro de entregas (outbox), así que puede correr en cada
 * carga de /marketing sin duplicar correos.
 */
export class RunDueAutomations {
  public constructor(
    private readonly automations: MarketingAutomationRepository,
    private readonly recipients: RecipientDirectory,
    private readonly deliveries: AutomationDeliveryLog,
    private readonly dispatcher: EmailDispatcher,
    /** Plantillas personalizadas del profesional (message_templates); tienen prioridad sobre el contenido de la automatización. */
    private readonly templates?: MessageTemplateOverrideRepository,
  ) {}

  public async run(input: { senderName: string; scheduleLink: string; now?: Date }): Promise<DueAutomationsResult> {
    const now = input.now ?? new Date();
    const birthdayGreetings = await this.runBirthdays(now, input.senderName, input.scheduleLink);
    const reactivations = await this.runReactivations(now, input.senderName, input.scheduleLink);
    return { birthdayGreetings, reactivations };
  }

  private async runBirthdays(now: Date, senderName: string, scheduleLink: string): Promise<number> {
    const automation = await this.automations.findByKind('cumpleanios');
    if (!automation.isEnabled()) return 0;
    let sent = 0;
    const recipients = await this.recipients.listWithBirthdayOn(now.getMonth() + 1, now.getDate());
    for (const recipient of recipients) {
      if (!this.canReceiveEmail(recipient)) continue;
      if (await this.deliveries.wasBirthdayGreetingSentThisYear(recipient.id, now.getFullYear())) continue;
      await this.dispatchAutomationEmail(automation, 'cumpleanios', recipient, senderName, scheduleLink);
      sent += 1;
    }
    return sent;
  }

  private async runReactivations(now: Date, senderName: string, scheduleLink: string): Promise<number> {
    const automation = await this.automations.findByKind('reactivacion');
    if (!automation.isEnabled()) return 0;
    const cutoffIso = subMonths(now, automation.reactivationMonths()).toISOString();
    let sent = 0;
    const recipients = await this.recipients.listInactiveSince(cutoffIso);
    for (const recipient of recipients) {
      if (!this.canReceiveEmail(recipient)) continue;
      if (await this.deliveries.wasReactivationSentSince(recipient.id, cutoffIso)) continue;
      await this.dispatchAutomationEmail(automation, 'reactivacion', recipient, senderName, scheduleLink);
      sent += 1;
    }
    return sent;
  }

  private canReceiveEmail(recipient: MarketingRecipient): boolean {
    return recipient.email.trim() !== '';
  }

  private async dispatchAutomationEmail(
    automation: MarketingAutomation,
    template: 'cumpleanios' | 'reactivacion',
    recipient: MarketingRecipient,
    senderName: string,
    scheduleLink: string,
  ): Promise<void> {
    // La plantilla personalizada del profesional (message_templates) va primero;
    // si no existe se usa el contenido configurado en la automatización.
    const custom = (await this.templates?.findByKey(template)) ?? null;
    const fromAutomation = automation.renderFor({
      nombre: recipient.fullName,
      profesional: senderName,
      ligaAgenda: scheduleLink,
    });
    const variables = { nombre: recipient.fullName, profesional: senderName, liga_agenda: scheduleLink };
    const rendered = custom
      ? {
          subject: custom.subject.trim()
            ? renderTemplateContent(custom.subject, variables)
            : fromAutomation.subject,
          body: renderTemplateContent(custom.body, variables),
        }
      : fromAutomation;
    await this.dispatcher.dispatch({
      template,
      patientId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.fullName,
      subject: rendered.subject,
      body: rendered.body,
    });
  }
}
