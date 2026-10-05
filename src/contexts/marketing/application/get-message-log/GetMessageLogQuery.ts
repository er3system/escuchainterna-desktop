import { OutboxLogChannel, OutboxLogCriteria } from '../../domain/repositories/OutboxMessageLog';

/** Clave de plantilla con la que salen TODAS las campañas (correo masivo). */
const CAMPAIGN_TEMPLATE = 'correo_masivo';

/** Tipo de mensaje para el filtro del registro: todo, automáticos o campañas. */
export type MessageLogTipo = 'todo' | 'automaticos' | 'campanas';

export class GetMessageLogQuery {
  private constructor(
    private readonly channel: OutboxLogChannel | null,
    private readonly tipo: MessageLogTipo,
    private readonly search: string,
    private readonly page: number,
    private readonly pageSize: number,
  ) {}

  /** `channel` admite los nombres de la UI: "whatsapp" | "correo". */
  public static fromPrimitives(input: {
    channel?: string;
    tipo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): GetMessageLogQuery {
    const rawChannel = (input.channel ?? '').trim().toLowerCase();
    const channel: OutboxLogChannel | null =
      rawChannel === 'whatsapp' ? 'whatsapp' : rawChannel === 'correo' || rawChannel === 'email' ? 'email' : null;
    const rawTipo = (input.tipo ?? '').trim();
    const tipo: MessageLogTipo =
      rawTipo === 'campanas' ? 'campanas' : rawTipo === 'automaticos' ? 'automaticos' : 'todo';
    return new GetMessageLogQuery(
      channel,
      tipo,
      (input.search ?? '').trim(),
      Math.max(1, input.page ?? 1),
      Math.min(100, Math.max(1, input.pageSize ?? 25)),
    );
  }

  public toCriteria(): OutboxLogCriteria {
    // Campañas = la plantilla 'correo_masivo'; Automáticos = todo MENOS esa.
    return {
      channel: this.channel ?? undefined,
      template: this.tipo === 'campanas' ? CAMPAIGN_TEMPLATE : undefined,
      excludeTemplate: this.tipo === 'automaticos' ? CAMPAIGN_TEMPLATE : undefined,
      search: this.search || undefined,
      limit: this.pageSize,
      offset: (this.page - 1) * this.pageSize,
    };
  }

  public currentTipo(): MessageLogTipo {
    return this.tipo;
  }

  public currentPage(): number {
    return this.page;
  }

  public currentPageSize(): number {
    return this.pageSize;
  }
}
