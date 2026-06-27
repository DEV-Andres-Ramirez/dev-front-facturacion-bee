import { PermissionRow } from '../models';

/** Matriz de permisos por rol (RBAC · RF-AUT-02). */
export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  { action: 'Cargar y validar facturación', admin: true, user: true },
  { action: 'Agrupar y enviar a emisión', admin: true, user: true },
  { action: 'Entregar factura al cliente', admin: true, user: true },
  { action: 'Conciliar y gestionar cobro', admin: true, user: true },
  { action: 'Gestionar usuarios y roles', admin: true, user: false },
  { action: 'Ver bitácora de auditoría', admin: true, user: false },
];
