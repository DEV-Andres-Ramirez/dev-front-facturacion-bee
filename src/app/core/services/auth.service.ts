import { Injectable, computed, inject, signal } from '@angular/core';
import { User, UserRole } from '../models';
import { SYSTEM_USERS } from '../data/system.seed';
import { AppConfigService } from './app-config.service';

/** Sesión activa del usuario autenticado. */
export interface Session {
  readonly user: User;
  readonly token: string;
}

const STORAGE_KEY = 'bee.session';

/**
 * Autenticación y control de acceso por rol (RF-AUT). En el prototipo no hay
 * backend: la sesión se valida contra las cuentas sembradas y el token de acceso
 * proviene de la configuración externa (.env), nunca del código fuente.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly appConfig = inject(AppConfigService);

  private readonly _session = signal<Session | null>(this.restore());

  readonly session = this._session.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly role = computed<UserRole | null>(() => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');

  /** Inicia sesión con un correo corporativo. Devuelve `false` si no existe. */
  loginWithEmail(email: string): boolean {
    const user = SYSTEM_USERS.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user) return false;
    this.start(user);
    return true;
  }

  /** Acceso rápido por rol (primer perfil del rol indicado). */
  loginAs(role: UserRole): void {
    const user = SYSTEM_USERS.find((candidate) => candidate.role === role) ?? SYSTEM_USERS[0];
    this.start(user);
  }

  logout(): void {
    this._session.set(null);
    this.clear();
  }

  private start(user: User): void {
    const session: Session = { user, token: this.appConfig.tokenFor(user.role) };
    this._session.set(session);
    this.persist(session);
  }

  private persist(session: Session): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria. */
    }
  }

  private clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sin almacenamiento: nada que limpiar. */
    }
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
}
