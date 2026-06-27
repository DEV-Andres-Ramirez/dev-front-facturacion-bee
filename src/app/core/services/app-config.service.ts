import { Injectable } from '@angular/core';
import { environment, AppEnvironment } from '@env';

/**
 * Acceso de solo lectura a la configuración de la aplicación (por entorno).
 * Identidad de marca y conexión a Supabase. Los parámetros de negocio
 * (retención, correos, secuencial) viven en la base de datos (app_settings).
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly config: AppEnvironment = environment;
}
