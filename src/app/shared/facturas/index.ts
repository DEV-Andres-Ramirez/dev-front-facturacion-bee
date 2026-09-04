/**
 * Componentes de dominio compartidos por más de una pantalla.
 *
 * `shared/ui` es el sistema de diseño y no sabe nada del negocio; esto sí lo
 * sabe, pero tampoco pertenece a un `feature` concreto porque lo usan varios.
 */
export { AnularFacturaDialog } from './anular-factura-dialog';
