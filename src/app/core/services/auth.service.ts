import { Injectable, computed, inject, signal } from '@angular/core';
import { User, UserRole, UsuarioRow } from '../models';
import { usuarioRowToUser } from '../utils/usuario.mapper';
import { SupabaseService } from './supabase.service';

/** Sesión activa del usuario autenticado. */
export interface Session {
  readonly user: User;
}

const STORAGE_KEY = 'bee.session';
const TOUCH_THROTTLE_MS = 60_000;

/**
 * Autenticación y control de acceso por rol (RF-AUT). Valida las credenciales
 * contra la tabla `usuarios` mediante la función `fn_login` (SECURITY DEFINER):
 * la contraseña nunca viaja al cliente. La sesión se conserva en el dispositivo
 * (localStorage) y el guard impide el acceso sin sesión válida.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _session = signal<Session | null>(this.restore());
  private lastTouch = 0;

  readonly session = this._session.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly role = computed<UserRole | null>(() => this._session()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');

  /** Inicia sesión validando credenciales contra la base de datos. */
  async login(correo: string, contrasena: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('fn_login', {
      p_correo: correo,
      p_contrasena: contrasena,
    });
    const rows = (data ?? []) as UsuarioRow[];
    if (error || rows.length === 0) return false;

    const session: Session = { user: usuarioRowToUser(rows[0]) };
    this._session.set(session);
    this.persist(session);
    this.lastTouch = Date.now();
    return true;
  }

  logout(): void {
    this._session.set(null);
    this.clear();
  }

  /**
   * Actualiza el último acceso del usuario en la BD al actuar en la aplicación.
   * Limitado en frecuencia para no saturar la red.
   */
  touch(): void {
    const id = this._session()?.user.id;
    if (!id) return;
    const now = Date.now();
    if (now - this.lastTouch < TOUCH_THROTTLE_MS) return;
    this.lastTouch = now;
    void this.supabase.rpc('fn_touch_acceso', { p_id: id });
  }

  private persist(session: Session): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria. */
    }
  }

  private clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sin almacenamiento: nada que limpiar. */
    }
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
}
