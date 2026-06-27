import { DocKind } from './common.model';

/** Carpeta de un periodo dentro del archivo documental (RF-DOC-01). */
export interface PeriodFolder {
  readonly id: string;
  readonly label: string;
  /** Resumen, p. ej. «18 archivos». */
  readonly fileCountLabel: string;
  /** `true` si es el periodo activo (resaltado en el árbol). */
  readonly active: boolean;
}

/** Subcarpeta por tipo de soporte dentro de un periodo. */
export interface DocCategory {
  readonly label: string;
  readonly count: number;
}

/** Documento conservado del ciclo (RF-DOC-02). */
export interface ArchivedFile {
  readonly name: string;
  readonly kind: DocKind;
  readonly meta: string;
}

/** Vista completa del archivo documental para el periodo seleccionado. */
export interface DocumentArchive {
  readonly years: readonly DocYear[];
  readonly categories: readonly DocCategory[];
  readonly files: readonly ArchivedFile[];
  /** Resumen del periodo activo, p. ej. «18 archivos · 12,4 MB». */
  readonly activeSummary: string;
  readonly synced: boolean;
}

/** Año agrupador del árbol de carpetas. */
export interface DocYear {
  readonly label: string;
  readonly monthsLabel: string;
  readonly folders: readonly PeriodFolder[];
}
