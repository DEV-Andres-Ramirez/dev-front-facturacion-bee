import { PurchaseType } from './invoice.model';

/** Línea consolidada dentro de una factura agrupada. */
export interface GroupLine {
  readonly talent: string;
  readonly roleMop: string;
  /** Entrega de valor / descripción, p. ej. «Feature pagos · 22 días». */
  readonly valueDelivery: string;
  readonly amountUsd: number;
}

/**
 * Factura propuesta tras agrupar las líneas por número de orden de compra
 * (RF-AGR-01). Regla de negocio: una factura por orden de compra.
 */
export interface InvoiceGroup {
  /** Secuencia asignada (RF-AGR-02), p. ej. «BEE709». */
  readonly id: string;
  readonly client: string;
  readonly order: string;
  readonly purchaseType: PurchaseType;
  readonly amountUsd: number;
  /** Valor en letras generado automáticamente (RF-AGR-03). */
  readonly amountInWords: string;
  readonly lines: readonly GroupLine[];
}
