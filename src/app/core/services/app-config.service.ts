import { Injectable } from '@angular/core';
import { environment, AppEnvironment } from '@env';
import { UserRole } from '../models';

/**
 * Acceso de solo lectura a la configuración de la aplicación (derivada de .env).
 * Centraliza los parámetros de negocio y los tokens de acceso para que ninguna
 * dirección de correo, tasa de retención o token quede embebido en el código.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly config: AppEnvironment = environment;

  /** Token de acceso correspondiente al rol (demo). */
  tokenFor(role: UserRole): string {
    return role === 'ADMIN' ? this.config.auth.tokenAdmin : this.config.auth.tokenUsuario;
  }
}
