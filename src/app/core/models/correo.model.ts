import { SemanticTone } from './common.model';

/**
 * Estado del servicio de correo y del envío de cada factura.
 *
 * El backend (`dev-back-facturacion-bee`) no solo dice si puede enviar: dice
 * **por qué no** y **qué buzón** falla. Sin ese dato, un fallo de envío se
 * queda en «avisa a soporte» y nadie sabe dónde mirar.
 */

/** Causa identificada del estado del buzón. Espejo del contrato del backend. */
export type CodigoDiagnostico =
  | 'OPERATIVO'
  | 'SIN_CONFIGURACION'
  | 'SMTP_AUTH_DESHABILITADO'
  | 'CREDENCIALES_RECHAZADAS'
  | 'BUZON_BLOQUEADO'
  | 'SERVIDOR_INALCANZABLE'
  | 'TIEMPO_AGOTADO'
  | 'ERROR_TLS'
  | 'LIMITE_ALCANZADO'
  | 'DESCONOCIDO';

/** Respuesta de `GET /api/email/verify`. */
export interface DiagnosticoCorreo {
  readonly operativo: boolean;
  /** Buzón desde el que se envía. Es el dato con el que se puede actuar. */
  readonly remitente: string;
  readonly servidor: string;
  readonly proveedor: string;
  readonly codigo: CodigoDiagnostico;
  readonly titulo: string;
  readonly detalle: string;
  readonly solucion: string;
  /** Respuesta cruda del servidor, para soporte. */
  readonly tecnico?: string;
  readonly verificadoEn: string;
}

/**
 * Resultado de comprobar el servicio.
 *
 * `indeterminado` no es lo mismo que `caido`: significa que no se pudo
 * preguntar (backend sin desplegar, red caída). Bloquear el envío por no haber
 * podido preguntar sería peor que dejarlo intentar y fallar con un error claro.
 */
export type ResultadoVerificacion =
  | { readonly estado: 'operativo'; readonly diagnostico: DiagnosticoCorreo }
  | { readonly estado: 'caido'; readonly diagnostico: DiagnosticoCorreo }
  | { readonly estado: 'indeterminado'; readonly motivo: string };

/** Estado de comprobación tal y como lo pinta la pantalla. */
export type EstadoServicio =
  | 'sin_comprobar'
  | 'comprobando'
  | 'operativo'
  | 'caido'
  | 'indeterminado';

/** Correo tal y como lo genera el sistema, antes de que nadie lo toque. */
export interface PlantillaCorreo {
  readonly secuencial: string;
  readonly to: string;
  readonly cc: string;
  readonly subject: string;
  readonly cuerpo: string;
  readonly adjuntos: readonly AdjuntoCorreo[];
  /** Soportes que faltan; se avisa antes de enviar en vez de mandar el correo incompleto. */
  readonly faltantes: readonly string[];
  readonly yaEnviada: boolean;
}

/** Adjunto que el backend descarga desde Supabase Storage. */
export interface AdjuntoCorreo {
  readonly url: string;
  readonly filename?: string;
}

/** Campos que el usuario cambió. Lo que no toca sigue derivándose de los datos. */
export interface EdicionCorreo {
  readonly to?: string;
  readonly cc?: string;
  readonly subject?: string;
  readonly cuerpo?: string;
}

/** Los campos de un correo que se pueden editar. */
export type CampoCorreo = 'to' | 'cc' | 'subject' | 'cuerpo';

/** El correo que realmente saldría, ya con las ediciones aplicadas. */
export interface CorreoPreparado extends PlantillaCorreo {
  readonly editado: boolean;
  readonly destinatarios: readonly string[];
  readonly copias: readonly string[];
  /** Direcciones mal escritas. Se señalan en su tarjeta, no al final del lote. */
  readonly invalidas: readonly string[];
  /** Si tiene lo mínimo para poder enviarse: un destinatario válido y un asunto. */
  readonly listo: boolean;
}

/** Estado del envío de una factura concreta dentro del lote. */
export type EstadoEnvio = 'pendiente' | 'enviando' | 'enviado' | 'error' | 'omitido';

/** Cómo se pinta cada estado de envío. */
export const PRESENTACION_ENVIO: Record<
  EstadoEnvio,
  { readonly etiqueta: string; readonly tono: SemanticTone }
> = {
  pendiente: { etiqueta: 'Pendiente', tono: 'neutral' },
  enviando: { etiqueta: 'Enviando…', tono: 'info' },
  enviado: { etiqueta: 'Enviado', tono: 'ok' },
  error: { etiqueta: 'Con error', tono: 'bad' },
  omitido: { etiqueta: 'Sin enviar', tono: 'warn' },
};
