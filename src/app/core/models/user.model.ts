import { AvatarTone } from './common.model';

/** Rol de control de acceso (RBAC · RF-AUT-02). */
export type UserRole = 'ADMIN' | 'USUARIO';

/** Estado de una cuenta de usuario. */
export type AccountStatus = 'Activa' | 'Inactiva';

/** Cuenta de usuario del sistema (RF-USR-01). */
export interface User {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly email: string;
  readonly area: string;
  readonly role: UserRole;
  readonly status: AccountStatus;
  /** Último acceso en formato legible, p. ej. «Hoy · 09:14». */
  readonly lastAccess: string;
  readonly avatar: AvatarTone;
}

/** Fila de la matriz de permisos por rol (RBAC). */
export interface PermissionRow {
  readonly action: string;
  readonly admin: boolean;
  readonly user: boolean;
}
