import { AvatarTone } from './common.model';

/** Resultado del cotejo de una línea (RF-VAL-02 / RF-VAL-04). */
export type ValidationStatus = 'coincide' | 'discrepancia' | 'sin_mop';

/**
 * Línea del cotejo de talentos: prefactura aprobada vs. registro interno.
 * Es la entidad central del módulo «Validar información».
 */
export interface ValidationLine {
  readonly id: string;
  readonly talent: string;
  readonly initials: string;
  readonly avatar: AvatarTone;
  /** Subtítulo: contrato y cliente, p. ej. «C-2291 · Acme Global». */
  readonly reference: string;
  /** Rol MOP o `null` si el talento no tiene contrato MOP. */
  readonly roleMop: string | null;
  /** Orden de compra asociada o `null`. */
  readonly order: string | null;
  /** Monto en la prefactura aprobada (USD). */
  readonly prefactura: number;
  /** Monto en el registro interno (USD) o `null` si no está registrado. */
  readonly registroInterno: number | null;
  readonly status: ValidationStatus;
}

/** Resumen del cotejo del periodo (tarjetas mini de «Validar»). */
export interface ValidationSummary {
  readonly cotejadas: number;
  readonly coinciden: number;
  readonly discrepancias: number;
  readonly sinMop: number;
}
