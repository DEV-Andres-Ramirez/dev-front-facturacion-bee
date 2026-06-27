import { DocKind } from '../models';

/** Presentación del icono de archivo según el tipo de soporte. */
export interface DocKindPresentation {
  /** Clase de fondo del sistema de diseño (.fx-*). */
  readonly fxClass: string;
  /** Etiqueta corta mostrada en la ficha. */
  readonly label: string;
}

const DOC_KIND: Record<DocKind, DocKindPresentation> = {
  xls: { fxClass: 'fx-xls', label: 'XLSX' },
  pdf: { fxClass: 'fx-pdf', label: 'PDF' },
  doc: { fxClass: 'fx-doc', label: 'DOC' },
  img: { fxClass: 'fx-img', label: 'IMG' },
};

export function docKindPresentation(kind: DocKind): DocKindPresentation {
  return DOC_KIND[kind];
}
