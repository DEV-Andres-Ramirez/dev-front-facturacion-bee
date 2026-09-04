/**
 * Periodo de facturación y etapa del ciclo.
 *
 * Hasta ahora el periodo era un tipo literal compilado en el bundle y el avance
 * del ciclo vivía en el `localStorage` de cada navegador. Ahora son datos: la
 * tabla `periodos` es la única fuente de verdad, compartida y auditable.
 */

/** Identificador del periodo: `'2026-08'`. También es el prefijo en Storage. */
export type PeriodoId = string;

/**
 * Etapas del ciclo, en orden. El valor guardado indica **dónde está** el
 * periodo; todo lo anterior se considera completado.
 */
export type EtapaCiclo =
  | 'carga'
  | 'validacion'
  | 'agrupacion'
  | 'revision'
  | 'entrega'
  | 'conciliacion'
  | 'archivo'
  | 'cerrado';

export const ETAPAS: readonly EtapaCiclo[] = [
  'carga',
  'validacion',
  'agrupacion',
  'revision',
  'entrega',
  'conciliacion',
  'archivo',
  'cerrado',
] as const;

/** Etiqueta de cada etapa, la misma que se pinta en la línea del ciclo. */
export const ETIQUETA_ETAPA: Record<EtapaCiclo, string> = {
  carga: 'Carga',
  validacion: 'Validar',
  agrupacion: 'Agrupar',
  revision: 'Revisar',
  entrega: 'Entregar',
  conciliacion: 'Conciliar',
  archivo: 'Registros',
  cerrado: 'Cerrado',
};

/** Ruta del módulo que corresponde a cada etapa, para poder navegar a ella. */
export const RUTA_ETAPA: Record<EtapaCiclo, string> = {
  carga: 'carga',
  validacion: 'validar',
  agrupacion: 'agrupar',
  revision: 'revisar',
  entrega: 'entregar',
  conciliacion: 'conciliar',
  archivo: 'registros',
  cerrado: 'dashboard',
};

/** Posición de una etapa en el ciclo; `-1` si no se reconoce. */
export function ordenEtapa(etapa: EtapaCiclo | string): number {
  return ETAPAS.indexOf(etapa as EtapaCiclo);
}

/** Fila de `periodos` tal como la devuelve `fn_listar_periodos`. */
export interface PeriodoRow {
  readonly id_periodo: PeriodoId;
  readonly anio_periodo: number;
  readonly mes_periodo: number;
  readonly etiqueta_periodo: string; // 'Agosto 2026' — la clave en las columnas periodo_*
  readonly etiqueta_corta_periodo: string; // 'Ago 2026'
  readonly etapa_periodo: EtapaCiclo;
  readonly estado_periodo: 'abierto' | 'cerrado';
  readonly fecha_creacion_periodo: string;
  readonly orden_etapa: number;
}

export const MESES: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** `2026, 9` → `'Septiembre 2026'`. */
export function etiquetaDePeriodo(anio: number, mes: number): string {
  return `${MESES[mes - 1] ?? '—'} ${anio}`;
}

/** `2026, 9` → `'2026-09'`. */
export function idDePeriodo(anio: number, mes: number): PeriodoId {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Totales de un periodo, tal como los devuelve `fn_resumen_periodos`.
 * Es la única consulta del aplicativo que cruza meses.
 */
export interface ResumenPeriodo {
  readonly id_periodo: PeriodoId;
  readonly etiqueta_periodo: string;
  readonly etiqueta_corta_periodo: string;
  readonly anio_periodo: number;
  readonly mes_periodo: number;
  readonly total_facturas: number;
  readonly facturado: number;
  readonly cobrado: number;
  readonly anuladas: number;
}
