/**
 * Tipos de documento que se persisten en `documentos_facturacion`. El tipo se
 * asigna según el espacio de carga desde donde se sube (o el módulo de origen).
 */
export type TipoDocumento =
  | 'Aprobación Prefactura'
  | 'Registro Facturación Interna'
  | 'Pedido Compra'
  | 'Novedades Periodo'
  | 'Factura BEE'
  | 'Consolidado Facturacion BEE';

/** Tipos que admiten un solo documento por periodo. */
export const TIPOS_UNICOS: readonly TipoDocumento[] = [
  'Aprobación Prefactura',
  'Registro Facturación Interna',
  'Novedades Periodo',
];

/** Fila de la tabla `documentos_facturacion` (índice de soportes del periodo). */
export interface DocumentoFacturacion {
  readonly id_documento_facturacion: number;
  readonly periodo_documento_facturacion: string;
  readonly tipo_documento_facturacion: TipoDocumento;
  /** URL pública del archivo en el Storage de Supabase. */
  readonly direccion_documento_facturacion: string;
}
