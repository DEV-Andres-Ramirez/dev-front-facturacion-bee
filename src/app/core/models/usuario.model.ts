/**
 * Fila de la tabla `usuarios` tal como la expone la vista `vw_usuarios`
 * (sin la columna de contraseña, que nunca viaja al cliente).
 */
export interface UsuarioRow {
  readonly id_usuario: string;
  readonly nombre_usuario: string;
  readonly correo_usuario: string;
  readonly area_usuario: string;
  readonly admin_usuario: boolean;
  readonly ultimo_acceso_usuario: string; // ISO timestamptz
  readonly estado_usuario: boolean;
}

/** Datos para crear una cuenta nueva. */
export interface NuevoUsuario {
  readonly nombre_usuario: string;
  readonly correo_usuario: string;
  readonly contrasena_usuario: string;
  readonly area_usuario: string;
  readonly admin_usuario: boolean;
  readonly estado_usuario: boolean;
}

/** Datos al editar una cuenta (la contraseña solo si se desea reemplazar). */
export interface EdicionUsuario {
  readonly nombre_usuario: string;
  readonly correo_usuario: string;
  readonly area_usuario: string;
  readonly admin_usuario: boolean;
  readonly estado_usuario: boolean;
  readonly contrasena_usuario?: string;
}
