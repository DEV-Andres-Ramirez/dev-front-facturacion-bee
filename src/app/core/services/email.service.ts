import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';

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
    if (error.status === 502) return 'El servidor de correo rechazó las credenciales. Avisa a soporte; reintentar no ayuda.';
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
export function esReintentable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 504 || error.status === 0);
}
