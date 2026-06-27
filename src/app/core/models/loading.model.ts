import { DocKind } from './common.model';

/** Estado del periodo en la pantalla de carga de documentos (RF-VAL-01). */
export interface PeriodLoadStatus {
  readonly linesDetected: number;
  readonly talentsMop: number;
  readonly orders: number;
  readonly currency: string;
  readonly readyToValidate: boolean;
}

/** Documento soporte cargado para el periodo. */
export interface LoadedDocument {
  readonly name: string;
  readonly kind: DocKind;
  readonly meta: string;
  readonly loaded: boolean;
}
