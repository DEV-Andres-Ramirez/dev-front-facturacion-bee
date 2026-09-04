/**
 * Formas de datos de los gráficos.
 *
 * Los gráficos se dibujan con SVG a mano y no con una librería: para un
 * reparto, unas barras y una serie mensual, una dependencia de 150-400 kB no
 * compensa, y además arrastraría su propia superficie de vulnerabilidades sobre
 * un aplicativo que hoy no tiene ninguna dependencia de presentación.
 */

/** Una porción o barra: lo que se mide y con qué color se pinta. */
export interface Porcion {
  readonly etiqueta: string;
  readonly valor: number;
  /** Color CSS; si falta, se usa la paleta por posición. */
  readonly color?: string;
  /** Texto secundario a la derecha (importe formateado, porcentaje…). */
  readonly detalle?: string;
}

/** Un punto de una serie temporal. */
export interface PuntoSerie {
  readonly etiqueta: string;
  readonly valor: number;
  /** Texto que se muestra al posarse encima. */
  readonly detalle?: string;
}

/** Paleta por defecto, en el orden en que se reparten las series. */
export const PALETA: readonly string[] = [
  'var(--honey-600)',
  'var(--info)',
  'var(--ok)',
  'var(--slate)',
  'var(--bad)',
  'var(--honey-deep)',
] as const;

export function colorDe(porcion: Porcion, indice: number): string {
  return porcion.color ?? PALETA[indice % PALETA.length];
}
