import {
  DashboardMetricsReader,
  DashboardSnapshot,
} from '../../domain/repositories/DashboardMetricsReader';

export class GetDashboardMetrics {
  public constructor(private readonly reader: DashboardMetricsReader) {}

  public get(reference: Date = new Date()): Promise<DashboardSnapshot> {
    return this.reader.snapshotAt(reference);
  }
}
