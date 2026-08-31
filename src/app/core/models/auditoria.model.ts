import { SemanticTone } from './common.model';

/**
 * Bitácora de auditoría (RF-LOG). Espejo de la tabla `auditoria` de Supabase,
 * que solo admite inserciones: un evento registrado no se puede alterar.
 */

/** Módulo del aplicativo donde ocurrió la acción. */
export type ModuloAuditoria =
  | 'Autenticación'
  | 'Carga'
  | 'Validación'
  | 'Agrupación'
  | 'Revisión'
  | 'Entrega'
  | 'Usuarios'
  | 'Periodo'
  | 'Conciliación'
  | 'Registros';

/**
 * Catálogo cerrado de acciones. Es una unión y no texto libre a propósito: así
 * el compilador impide que dos pantallas registren la misma acción con nombres
 * distintos, que es lo que convierte una bitácora en algo imposible de filtrar.
 */
export type AccionAuditoria =
  // Autenticación
  | 'INICIO_SESION'
  | 'INICIO_SESION_FALLIDO'
  | 'CIERRE_SESION'
  // Periodo y ciclo
  | 'CAMBIAR_PERIODO'
  | 'CREAR_PERIODO'
  | 'AVANZAR_ETAPA'
  | 'REABRIR_ETAPA'
  // Carga de documentos
  | 'CARGAR_DOCUMENTO'
  | 'ELIMINAR_DOCUMENTO'
  | 'RECHAZAR_ARCHIVO'
  // Ciclo de facturación
  | 'VALIDAR_PERIODO'
  | 'AGRUPAR_PERIODO'
  | 'ACTUALIZAR_FACTURA'
  | 'REVISAR_PERIODO'
  | 'BLOQUEAR_AVANCE'
  | 'ANULAR_FACTURA'
  | 'ENVIAR_FACTURA'
  // Conciliación y registros
  | 'REGISTRAR_PAGO'
  | 'DESCARGAR_SOPORTE'
  | 'DESCARGAR_PERIODO'
  | 'GUARDAR_PARAMETRO'
  // Gestión de cuentas
  | 'CREAR_USUARIO'
  | 'ACTUALIZAR_USUARIO'
  | 'HABILITAR_USUARIO'
  | 'DESHABILITAR_USUARIO';

/** Desenlace de la acción. Determina el tono con el que se pinta en la tabla. */
export type ResultadoAuditoria = 'exito' | 'advertencia' | 'error';

/** Fila tal como la devuelve `fn_listar_auditoria`. */
export interface AuditoriaRow {
  readonly id_auditoria: number;
  readonly fecha_auditoria: string; // ISO timestamptz
  readonly id_usuario_auditoria: string | null;
  readonly nombre_usuario_auditoria: string;
  readonly correo_usuario_auditoria: string;
  readonly rol_usuario_auditoria: string;
  readonly modulo_auditoria: string;
  readonly accion_auditoria: string;
  readonly resultado_auditoria: ResultadoAuditoria;
  readonly observacion_auditoria: string;
  readonly periodo_auditoria: string | null;
  readonly entidad_auditoria: string | null;
  readonly referencia_auditoria: string | null;
  readonly detalle_auditoria: Record<string, unknown> | null;
  readonly ip_auditoria: string | null;
  readonly agente_auditoria: string | null;
  readonly total_filas: number; // count(*) over() — el total del filtro
}

/**
 * Lo que aporta quien registra un evento: solo QUÉ pasó.
 *
 * El quién (usuario y rol), el cuándo y el periodo los añade `AuditoriaService`;
 * la IP y el navegador los añade la base de datos. Ninguna pantalla tiene que
 * acordarse de ellos, y por tanto ninguna puede equivocarse.
 */
export interface NuevoEventoAuditoria {
  readonly modulo: ModuloAuditoria;
  readonly accion: AccionAuditoria;
  /** Frase legible en español: lo que leerá una persona en la bitácora. */
  readonly observacion: string;
  readonly resultado?: ResultadoAuditoria;
  /** Tipo de objeto afectado: `documento`, `factura`, `usuario`, `periodo`. */
  readonly entidad?: string;
  /** Identificador del objeto: secuencial, nombre de archivo, correo. */
  readonly referencia?: string;
  /** Datos estructurados del evento. **Nunca** contraseñas ni URL de Storage. */
  readonly detalle?: Record<string, unknown>;
  /**
   * Usuario a registrar cuando no hay sesión activa (un login fallido) o cuando
   * la acción cierra la sesión y hay que capturarlo antes de que desaparezca.
   */
  readonly actor?: { readonly nombre: string; readonly correo: string };
}

/** Filtros de la consulta. `pagina` es base 0. */
export interface FiltroAuditoria {
  readonly desde: string | null;
  readonly hasta: string | null;
  readonly correo: string | null;
  readonly modulo: string | null;
  readonly accion: string | null;
  readonly resultado: string | null;
  readonly busqueda: string;
  readonly pagina: number;
}

/** Métricas de cabecera, siempre referidas al filtro activo. */
export interface ResumenAuditoria {
  readonly total_eventos: number;
  readonly usuarios_distintos: number;
  readonly eventos_error: number;
  readonly modulo_top: string | null;
}

/** Valor real presente en la bitácora, para poblar un desplegable. */
export interface OpcionFiltro {
  readonly tipo: 'usuario' | 'modulo' | 'accion';
  readonly valor: string;
  readonly etiqueta: string;
}

/** Tono del badge según el desenlace de la acción. */
export const TONO_RESULTADO: Record<ResultadoAuditoria, SemanticTone> = {
  exito: 'ok',
  advertencia: 'warn',
  error: 'bad',
};

/** Etiqueta legible del desenlace. */
export const ETIQUETA_RESULTADO: Record<ResultadoAuditoria, string> = {
  exito: 'Correcto',
  advertencia: 'Con avisos',
  error: 'Fallido',
};
