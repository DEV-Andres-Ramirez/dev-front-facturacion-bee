/**
 * Datos a insertar en `registro_facturacion_interna` (sin id). Las 13 columnas
 * siguen el orden de la plantilla «Registro Facturación Interna». Todo se guarda
 * como texto; `monto_facturar_facturacion_interna` conserva 2 decimales sin
 * aproximar para los cotejos aritméticos posteriores.
 */
export interface RegistroInternaInsert {
  periodo_facturacion_interna: string;
  pedido_compra_facturacion_interna: string | null;
  secuencial_facturacion_interna: string | null;
  mes_facturacion_interna: string | null;
  cliente_facturacion_interna: string | null;
  id_colaborados_facturacion_interna: string | null;
  descripcion_facturacion_interna: string | null;
  tipo_moneda_facturacion_interna: string | null;
  tarifa_facturacion_interna: string | null;
  hora_novedad_facturacion_interna: string | null;
  tarifa_hora_facturacion_interna: string | null;
  monto_facturar_facturacion_interna: string | null;
  valor_letras_facturacion_interna: string | null;
  email_aprobador_facturacion_interna: string | null;
}

/** Fila completa de `registro_facturacion_interna` (incluye la llave primaria). */
export interface RegistroInternaRow extends RegistroInternaInsert {
  readonly id_facturacion_interna: number;
  /** Enlace al PDF del pedido de compra (se relaciona por nombre/secuencial). */
  readonly documento_pedido_compra: string | null;
  /** Enlace a la Factura BEE cargada en Revisar (compartido por la factura). */
  readonly documento_factura_bee: string | null;
  /** Monto emitido global de la factura (ingresado en Revisar). */
  readonly monto_emitido_factura_bee: string | null;
  /** Fecha de la factura física (ingresada en Revisar). */
  readonly fecha_factura_bee: string | null;
}
