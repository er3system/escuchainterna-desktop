import type { CurrencyAmount } from '../value-objects/currencyTotals';

export interface SessionCountsByStatus {
  total: number;
  completed: number;
  confirmed: number;
  scheduled: number;
  cancelled: number;
  noShow: number;
  rescheduled: number;
}

export interface MethodIncomeShare {
  method: string;
  /** Moneda de los pagos sumados en este renglón (código ISO). */
  currency: string;
  amount: number;
  /** Participación del método DENTRO de su moneda (los % cruzados no tienen sentido). */
  percentage: number;
}

export interface GenderShare {
  gender: string;
  count: number;
  percentage: number;
}

export interface MonthlyHistoryPoint {
  /** Clave del mes 'yyyy-MM' (mes local). */
  month: string;
  sessions: number;
  /**
   * Ingreso cobrado del mes DESGLOSADO por moneda (código ISO → monto). Antes era
   * un único número que sumaba monedas distintas (COP + USD en el mismo total), lo
   * que no tiene sentido; ahora el dashboard muestra una moneda a la vez. Vacío si
   * no hubo cobros ese mes.
   */
  incomeByCurrency: Record<string, number>;
}

export interface DashboardSnapshot {
  /** Ingresos cobrados en el mes (por fecha de pago), un renglón por moneda. */
  collectedThisMonth: CurrencyAmount[];
  collectedPreviousMonth: CurrencyAmount[];
  /** Pendiente de cobro de sesiones del mes (no canceladas), por moneda. */
  pendingThisMonth: CurrencyAmount[];
  /** Pendiente de cobro acumulado de sesiones ya ocurridas, por moneda. */
  pendingTotal: CurrencyAmount[];
  sessions: SessionCountsByStatus;
  sessionsPreviousMonthTotal: number;
  newPatientsThisMonth: number;
  newPatientsPreviousMonth: number;
  genderDistribution: GenderShare[];
  incomeByMethod: MethodIncomeShare[];
  /** 12 meses, del más antiguo al actual. */
  history: MonthlyHistoryPoint[];
  hasAnyBookings: boolean;
}

/**
 * Lectura CQRS de métricas del dashboard (mes en curso + comparación + histórico).
 */
export interface DashboardMetricsReader {
  snapshotAt(reference: Date): Promise<DashboardSnapshot>;
}
