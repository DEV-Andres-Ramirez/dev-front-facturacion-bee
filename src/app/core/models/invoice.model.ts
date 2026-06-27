/** Estado de una factura según el código de color del proceso (RF-CON-03). */
export type InvoiceStatus = 'pagada' | 'pendiente' | 'anulada';

/** Tipo de compra de una línea/factura. */
export type PurchaseType = 'OPEX' | 'CAPEX';

/** Factura del periodo, mostrada en el tablero y el seguimiento de cobro. */
export interface Invoice {
  /** Secuencia interna, p. ej. «BEE709». */
  readonly id: string;
  readonly client: string;
  /** Número de orden de compra, p. ej. «PCC-2026-01521». */
  readonly order: string;
  readonly amountUsd: number;
  readonly status: InvoiceStatus;
  /** Días transcurridos del envío al pago. */
  readonly days: number;
  /** Subtítulo de contexto, p. ej. «Mayo · Talento MOP». */
  readonly note: string;
  readonly purchaseType: PurchaseType;
}
