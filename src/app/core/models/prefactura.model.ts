import { AvatarTone } from './common.model';
import { PurchaseType } from './invoice.model';

/**
 * Línea de la prefactura aprobada importada desde el Excel del cliente
 * (hoja «Detalle» de «BEE - Aprobación de Prefactura»). Es la entrada del ciclo:
 * lo que el sistema lee del archivo antes de cotejar contra el registro interno.
 */
export interface PrefacturaLine {
  readonly id: string;
  readonly talent: string;
  readonly initials: string;
  readonly avatar: AvatarTone;
  readonly roleMop: string;
  readonly purchaseType: PurchaseType;
  /** Entrega de valor / proyecto, p. ej. «EVC-717008 · Interoperabilidad Yappy». */
  readonly project: string;
  /** Monto a facturar (USD). */
  readonly amountUsd: number;
  /** Aprobador ante quien se radica la factura. */
  readonly approver: string;
  readonly approved: boolean;
}
