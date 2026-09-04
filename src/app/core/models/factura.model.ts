import { SemanticTone } from './common.model';

/**
 * La factura como entidad propia (tabla `facturas`).
 *
 * Antes una factura era el resultado de agrupar `registro_facturacion_interna`
 * por secuencial, con el monto y la fecha repetidos en cada línea del grupo.
 * Sin entidad propia no había dónde guardar su estado, su fecha de envío ni su
 * conciliación, que es lo que exigen RF-CON y RF-ENV-03.
 */

/** Estado de la factura. El color del proceso sale de aquí (RF-CON-03). */
export type EstadoFactura = 'emitida' | 'enviada' | 'pagada' | 'anulada';

export const ESTADOS_FACTURA: readonly EstadoFactura[] = [
  'emitida',
  'enviada',
  'pagada',
  'anulada',
] as const;

/** Fila de `facturas` tal como la devuelve `fn_listar_facturas`. */
export interface FacturaRow {
  readonly id_factura: number;
  readonly periodo_factura: string;
  readonly secuencial_factura: string;
  readonly pedido_compra_factura: string | null;
  readonly cliente_factura: string | null;
  readonly moneda_factura: string;
  readonly monto_facturado_factura: number | null;
  readonly monto_emitido_factura: number | null;
  readonly fecha_emision_factura: string | null;
  readonly estado_factura: EstadoFactura;
  readonly fecha_envio_factura: string | null;
  readonly fecha_pago_factura: string | null;
  readonly valor_recibido_factura: number | null;
  readonly retencion_pct_factura: number | null;
  readonly valor_retenido_factura: number | null;
  readonly trm_factura: number | null;
  readonly equivalente_cop_factura: number | null;
  readonly soporte_pago_factura: string | null;
  readonly motivo_anulacion_factura: string | null;
  readonly anulada_por_factura: string | null;
  readonly fecha_anulacion_factura: string | null;
  readonly observacion_factura: string | null;
  /** Del envío al pago, o del envío a hoy si aún no se ha pagado. */
  readonly dias_transcurridos: number | null;
  /** Enviada y fuera del plazo parametrizado, sin pago registrado. */
  readonly vencida: boolean;
}

/**
 * Un secuencial del Excel que ya pertenece a otro periodo.
 *
 * El número de factura es único en toda la historia de la empresa: anularla no
 * lo libera. Si el registro interno trae uno ya consumido, la sincronización lo
 * rechaza y lo devuelve aquí para poder decir de quién era.
 */
export interface SecuencialEnConflicto {
  readonly secuencial: string;
  readonly periodo: string;
  readonly estado: EstadoFactura;
}

/** Lo que devuelve `fn_sincronizar_facturas`. */
export interface InformeSincronizacion {
  readonly creadas: number;
  readonly omitidas: number;
  readonly conflictos: readonly SecuencialEnConflicto[];
}

/** Datos del pago recibido (RF-CON-01). */
export interface RegistroPago {
  readonly fechaPago: string;
  readonly valorRecibido: number;
  readonly trm: number;
  readonly retencionPct?: number;
  readonly soporte?: string;
}

/**
 * Presentación del estado: el código de color que pide RF-CON-03.
 * Verde pagada · azul pendiente de cobro · rojo anulada.
 */
export const PRESENTACION_ESTADO: Record<
  EstadoFactura,
  { readonly tone: SemanticTone; readonly label: string }
> = {
  emitida: { tone: 'neutral', label: 'Emitida' },
  enviada: { tone: 'info', label: 'Enviada' },
  pagada: { tone: 'ok', label: 'Pagada' },
  anulada: { tone: 'bad', label: 'Anulada' },
};

/** Una factura anulada no se entrega ni suma en los totales del periodo. */
export function cuentaParaElPeriodo(factura: FacturaRow): boolean {
  return factura.estado_factura !== 'anulada';
}
