import { User, UsuarioRow } from '../models';

/** Iniciales a partir del nombre completo (máx. 2 letras). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : parts[0].charAt(1);
  return (first + second).toUpperCase();
}

const ACCESS_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Formatea el último acceso (UTC) a hora de Colombia: «27/06/2026 · 14:30». */
export function formatAccess(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return ACCESS_FORMAT.format(date).replace(', ', ' · ');
}

/** Convierte una fila de la BD en el modelo de usuario de la aplicación. */
export function usuarioRowToUser(row: UsuarioRow): User {
  return {
    id: row.id_usuario,
    name: row.nombre_usuario,
    initials: initialsOf(row.nombre_usuario),
    email: row.correo_usuario,
    area: row.area_usuario,
    role: row.admin_usuario ? 'ADMIN' : 'USUARIO',
    status: row.estado_usuario ? 'Activa' : 'Inactiva',
    lastAccess: formatAccess(row.ultimo_acceso_usuario),
    avatar: row.admin_usuario ? 'ink' : 'honey',
  };
}
