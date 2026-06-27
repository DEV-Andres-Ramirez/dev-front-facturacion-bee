import { InvoiceStatus } from './invoice.model';

/** Fila del consolidado de conciliación del periodo (RF-CON-04). */
export interface ReconciliationRow {
  readonly invoiceId: string;
  readonly client: string;
  readonly order: string;
  readonly amountUsd: number;
  /** TRM DIAN aplicada o `null` si aún no hay pago. */
  readonly trm: number | null;
  /** Valor recibido en COP o `null`. */
  readonly receivedCop: number | null;
  /** Retención aplicada (USD) o `null`. */
  readonly retentionUsd: number | null;
  readonly status: InvoiceStatus;
}

/** Totales consolidados del periodo (RF-CON-04). */
export interface ReconciliationTotals {
  readonly billedUsd: number;
  readonly receivedUsd: number;
  readonly retentionUsd: number;
  readonly equivalentCopLabel: string;
}

/** Detalle de conciliación de una factura pagada (RF-CON-02). */
export interface ReconciliationDetail {
  readonly invoiceId: string;
  readonly billedUsd: number;
  readonly retentionUsd: number;
  readonly netExpectedUsd: number;
  readonly trm: number;
  readonly receivedCopLabel: string;
  readonly paymentDays: number;
}
