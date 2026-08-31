/**
 * Parámetros de negocio (tabla `parametros`).
 *
 * RF-CON-02, RF-ENV-02 y RF-USR-02 exigen que la retención, la TRM, los
 * destinatarios y los plazos se configuren y no vivan escritos en el código.
 */

/** Claves conocidas. Es una unión cerrada para que el compilador cace erratas. */
export type ClaveParametro =
  | 'retencion_pct'
  | 'trm_defecto'
  | 'moneda_reporte'
  | 'plazo_pago_dias'
  | 'correo_cliente'
  | 'correo_copias'
  | 'asunto_entrega'
  | 'proveedor_nombre';

export interface ParametroRow {
  readonly clave: ClaveParametro;
  readonly valor: string;
  readonly descripcion: string;
  readonly grupo: string;
}

/**
 * Valores de respaldo si la tabla no responde. No son «la configuración»: son
 * lo mínimo para que la pantalla no se quede en blanco ante un fallo de red.
 */
export const PARAMETROS_POR_DEFECTO: Record<ClaveParametro, string> = {
  retencion_pct: '12.5',
  trm_defecto: '4100',
  moneda_reporte: 'COP',
  plazo_pago_dias: '30',
  correo_cliente: '',
  correo_copias: '',
  asunto_entrega: 'Emisión Factura {secuencial} · {periodo}',
  proveedor_nombre: 'BEE CONSULTORIA Y NEGOCIOS SAS',
};
