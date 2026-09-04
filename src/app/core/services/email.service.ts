import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { DiagnosticoCorreo, ResultadoVerificacion } from '../models';

/** Adjunto que el backend descarga desde Supabase Storage. */
export interface AdjuntoPorUrl {
  readonly url: string;
  readonly filename?: string;
}

export interface CorreoRequest {
  readonly to: string | readonly string[];
  readonly cc?: string | readonly string[];
  readonly bcc?: string | readonly string[];
  readonly replyTo?: string;
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly attachmentUrls?: readonly AdjuntoPorUrl[];
}

export interface CorreoEnviado {
  readonly success: true;
  readonly messageId: string;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
  readonly attachments: number;
  readonly durationMs: number;
}

/** Envío de correos a través del backend dev-back-facturacion-bee. */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.api;

  /**
   * Comprueba si el buzón del backend puede enviar, sin enviar nada.
   *
   * Nunca lanza. Distingue tres situaciones que se parecen pero se resuelven
   * distinto: el buzón funciona, el buzón está caído (y entonces el backend
   * dice por qué y con qué remitente), o **no se pudo preguntar** — el backend
   * aún no tiene el endpoint, o no hay red—. Este último caso no debe impedir
   * el envío: sería bloquear por una causa que ni siquiera se ha confirmado.
   */
  async verificarServicio(): Promise<ResultadoVerificacion> {
    try {
      const diagnostico = await firstValueFrom(
        this.http.get<DiagnosticoCorreo>(`${this.api.url}/api/email/verify`, {
          headers: { 'x-api-key': this.api.key },
        }),
      );

      return diagnostico.operativo
        ? { estado: 'operativo', diagnostico }
        : { estado: 'caido', diagnostico };
    } catch (error) {
      return { estado: 'indeterminado', motivo: motivoSinComprobar(error) };
    }
  }

  async enviar(correo: CorreoRequest): Promise<CorreoEnviado> {
    return firstValueFrom(
      this.http.post<CorreoEnviado>(`${this.api.url}/api/email/send`, correo, {
        headers: { 'x-api-key': this.api.key },
      }),
    );
  }
}

/**
 * Extrae el mensaje que el backend devuelve en `message`, que llega como
 * arreglo cuando falla la validación y como cadena cuando falla un servicio.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const detalle: unknown = (error.error as { message?: unknown } | null)?.message;
    if (Array.isArray(detalle)) return detalle.join(' ');
    if (typeof detalle === 'string') return detalle;
    if (error.status === 0) return 'No se pudo contactar con el servicio de correo.';
    if (error.status === 502)
      return 'El servidor de correo rechazó las credenciales. Avisa a soporte; reintentar no ayuda.';
    return `Error ${error.status} al enviar el correo.`;
  }
  return 'Error inesperado al enviar el correo.';
}

/**
 * Según la tabla de errores de CONSUMO.md solo son reintentables el 504
 * (SMTP sin respuesta) y el fallo de red (status 0, p. ej. arranque en frío).
 * Un 400 exige corregir datos, un 401 es configuración y un 502 es EAUTH:
 * reintentarlos solo repite el fallo.
 */
/** Por qué no se pudo comprobar el servicio. Se muestra tal cual al usuario. */
function motivoSinComprobar(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado al comprobar el servicio de correo.';
  }

  // El backend desplegado puede ser anterior a la versión que expone la
  // comprobación. Es una situación transitoria, no un fallo del buzón.
  if (error.status === 404) {
    return 'El servicio de correo desplegado todavía no permite comprobar el buzón. Actualiza el backend para ver su estado antes de enviar.';
  }
  if (error.status === 0) {
    return 'No se pudo contactar con el servicio de correo para comprobar el buzón.';
  }
  if (error.status === 401) {
    return 'El servicio de correo rechazó la clave de la aplicación, así que no se pudo comprobar el buzón. Revisa la configuración del despliegue.';
  }

  return `No se pudo comprobar el buzón (error ${error.status}).`;
}

export function esReintentable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 504 || error.status === 0);
}
