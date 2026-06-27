/**
 * Identificador de periodo de facturación (formato ISO mes: AAAA-MM).
 * - `2026-05` (Mayo 2026): periodo con datos de ejemplo sembrados.
 * - `2026-06` (Junio 2026): periodo en blanco, para iniciar el ciclo desde cero.
 */
export type PeriodId = '2026-05' | '2026-06';

/** Opción de periodo mostrada en el selector «Periodo» del encabezado. */
export interface PeriodOption {
  readonly id: PeriodId;
  /** Etiqueta larga, p. ej. «Mayo 2026». */
  readonly label: string;
  /** Etiqueta corta para chips, p. ej. «May 2026». */
  readonly shortLabel: string;
}

/** Catálogo de periodos disponibles (orden cronológico). */
export const PERIODS: readonly PeriodOption[] = [
  { id: '2026-05', label: 'Mayo 2026', shortLabel: 'May 2026' },
  { id: '2026-06', label: 'Junio 2026', shortLabel: 'Jun 2026' },
] as const;
