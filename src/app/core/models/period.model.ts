/**
 * Identificador de periodo de facturación (formato ISO mes: AAAA-MM).
 * El ciclo opera sobre datos reales persistidos en Supabase; los periodos se
 * agregan aquí a medida que se abren.
 */
export type PeriodId = '2026-08';

/** Opción de periodo mostrada en el selector «Periodo» del encabezado. */
export interface PeriodOption {
  readonly id: PeriodId;
  /** Etiqueta larga, p. ej. «Agosto 2026». */
  readonly label: string;
  /** Etiqueta corta para chips, p. ej. «Ago 2026». */
  readonly shortLabel: string;
}

/** Catálogo de periodos disponibles (orden cronológico). */
export const PERIODS: readonly PeriodOption[] = [
  { id: '2026-08', label: 'Agosto 2026', shortLabel: 'Ago 2026' },
] as const;
