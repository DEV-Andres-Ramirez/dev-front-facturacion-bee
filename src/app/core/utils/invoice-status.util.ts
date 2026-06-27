import { InvoiceStatus, SemanticTone } from '../models';

/** Presentación (tono + etiqueta) del estado de una factura (RF-CON-03). */
export interface StatusPresentation {
  readonly tone: SemanticTone;
  readonly label: string;
}

const STATUS: Record<InvoiceStatus, StatusPresentation> = {
  pagada: { tone: 'ok', label: 'Pagada' }, // Verde
  pendiente: { tone: 'info', label: 'Pendiente' }, // Azul
  anulada: { tone: 'bad', label: 'Anulada' }, // Rojo
};

export function invoiceStatusPresentation(status: InvoiceStatus): StatusPresentation {
  return STATUS[status];
}
