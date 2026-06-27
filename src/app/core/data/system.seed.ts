import { PermissionRow, User } from '../models';

/**
 * Cuentas del sistema (RF-USR-01): 1 administrador + 2 usuarios.
 * Son configuración del sistema, independientes del periodo de facturación.
 */
export const SYSTEM_USERS: readonly User[] = [
  {
    id: 'u-va',
    name: 'Viviana Álvarez',
    initials: 'VA',
    email: 'viviana.alvarez@beeconsultoria.com',
    area: 'Dirección Operativa',
    role: 'ADMIN',
    status: 'Activa',
    lastAccess: 'Hoy · 09:14',
    avatar: 'ink',
  },
  {
    id: 'u-cf',
    name: 'Carolina Forero',
    initials: 'CF',
    email: 'carolina.forero@beeconsultoria.com',
    area: 'Área Financiera',
    role: 'USUARIO',
    status: 'Activa',
    lastAccess: 'Hoy · 08:02',
    avatar: 'honey',
  },
  {
    id: 'u-ms',
    name: 'Mateo Suárez',
    initials: 'MS',
    email: 'mateo.suarez@beeconsultoria.com',
    area: 'Coordinación de Proyectos',
    role: 'USUARIO',
    status: 'Activa',
    lastAccess: 'Ayer · 17:38',
    avatar: 'ok',
  },
];

/** Matriz de permisos por rol (RBAC · RF-AUT-02). */
export const PERMISSION_MATRIX: readonly PermissionRow[] = [
  { action: 'Cargar y validar facturación', admin: true, user: true },
  { action: 'Agrupar y enviar a emisión', admin: true, user: true },
  { action: 'Entregar factura al cliente', admin: true, user: true },
  { action: 'Conciliar y gestionar cobro', admin: true, user: true },
  { action: 'Gestionar usuarios y roles', admin: true, user: false },
  { action: 'Ver bitácora de auditoría', admin: true, user: false },
];
