/** Factura emitida por el outsourcing (Stratop) pendiente de cotejo (RF-REV). */
export interface EmittedInvoice {
  readonly id: string;
  readonly client: string;
  readonly order: string;
  /** Monto emitido en el PDF (USD). */
  readonly amountEmitted: number;
  /** Monto esperado según lo agrupado (USD). */
  readonly amountExpected: number;
  /** `true` si orden, número y monto coinciden (RF-REV-02). */
  readonly matches: boolean;
}

/** Control de cotejo verificado en la revisión (RF-REV-02). */
export interface ReviewCheck {
  readonly label: string;
  readonly passed: number;
  readonly total: number;
}
