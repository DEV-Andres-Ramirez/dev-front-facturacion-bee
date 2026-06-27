/**
 * Datos a insertar en `aprobacion_prefactura` (sin id). Las 25 columnas siguen
 * el orden de la plantilla «Aprobación Prefactura». Todos los valores se
 * guardan como texto; `monto_facturar_prefactura` conserva 2 decimales sin
 * aproximar para los cotejos aritméticos posteriores.
 */
export interface AprobacionPrefacturaInsert {
  periodo_prefactura: string;
  numero_contrato_prefactura: string | null;
  etiqueta_aliado_prefactura: string | null;
  año_prefactura: string | null;
  mes_prefactura: string | null;
  nombre_colaborador_prefactura: string | null;
  id_colaborador_prefactura: string | null;
  rol_mop_prefactura: string | null;
  tipo_compra_prefactura: string | null;
  entega_valor_prefactura: string | null;
  tarifa_prefactura: string | null;
  desglose_novedad_prefactura: string | null;
  hora_novedad_prefactura: string | null;
  tarifa_hora_prefactura: string | null;
  monto_novedad_prefactura: string | null;
  monto_facturar_prefactura: string | null;
  comentarios_proveedor_prefactura: string | null;
  comentarios_capacidad_prefactura: string | null;
  id_proyecto_prefactura: string | null;
  nombre_proyecto_prefactura: string | null;
  quien_paga_prefactura: string | null;
  radicar_factura_prefactura: string | null;
  lider_aprobador_prefactura: string | null;
  trabajo_compartido_prefactura: string | null;
  aprobado_prefactura: string | null;
  comentarios_lider_prefactura: string | null;
}

/** Fila completa de `aprobacion_prefactura` (incluye la llave primaria). */
export interface AprobacionPrefacturaRow extends AprobacionPrefacturaInsert {
  readonly id_prefactura: number;
}
