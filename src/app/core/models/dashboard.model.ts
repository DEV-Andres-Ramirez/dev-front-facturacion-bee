import { SemanticTone } from './common.model';

/** Indicador clave del ciclo de facturación (RF-DSH-01). */
export interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly tone: SemanticTone;
  /** Nombre del icono (ver IconName en shared/ui/icon). */
  readonly icon: string;
}

/** Resumen financiero del periodo mostrado en el tablero. */
export interface FinancialSummary {
  readonly totalCollectedUsd: number;
  readonly receivableUsd: number;
  readonly retentionUsd: number;
  readonly equivalentCopLabel: string;
  /** Porcentaje de avance de cobro (0–100). */
  readonly collectionProgress: number;
  /** Tiempo promedio de cobro en días. */
  readonly avgCollectionDays: number;
}

/** Acción pendiente que requiere atención (RF-DSH-03). */
export interface PendingAction {
  readonly title: string;
  readonly description: string;
  readonly tone: SemanticTone;
  readonly icon: string;
  /** Ruta del módulo destino (clave de pantalla), p. ej. «validar». */
  readonly target: string;
}

/** Conjunto de datos del tablero para un periodo. */
export interface DashboardData {
  readonly kpis: readonly Kpi[];
  readonly financial: FinancialSummary | null;
  readonly pendingActions: readonly PendingAction[];
}
