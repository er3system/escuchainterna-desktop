import { OutboxLogEntry, OutboxMessageLog } from '../../domain/repositories/OutboxMessageLog';
import { GetMessageLogQuery } from './GetMessageLogQuery';

export interface MessageLogPage {
  entries: OutboxLogEntry[];
  total: number;
  templates: string[];
  page: number;
  pageSize: number;
}

export class GetMessageLog {
  public constructor(private readonly log: OutboxMessageLog) {}

  public async get(query: GetMessageLogQuery): Promise<MessageLogPage> {
    const criteria = query.toCriteria();
    const [entries, total, templates] = await Promise.all([
      this.log.search(criteria),
      this.log.countMatching(criteria),
      this.log.listTemplates(),
    ]);
    return {
      entries,
      total,
      templates,
      page: query.currentPage(),
      pageSize: query.currentPageSize(),
    };
  }
}
