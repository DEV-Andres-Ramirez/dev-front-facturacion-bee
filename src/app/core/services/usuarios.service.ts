import { Injectable, computed, inject, signal } from '@angular/core';
import type { PostgrestError } from '@supabase/supabase-js';
import { EdicionUsuario, NuevoUsuario, User, UsuarioRow } from '../models';
import { usuarioRowToUser } from '../utils/usuario.mapper';
import { SupabaseService } from './supabase.service';

/** Resultado de una operación de escritura. */
export interface OpResult {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Gestión de cuentas de usuario contra la tabla `usuarios` de Supabase
 * (RF-USR). La lectura usa la vista `vw_usuarios` (sin contraseña).
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _rows = signal<UsuarioRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Usuarios mapeados al modelo de presentación. */
  readonly users = computed<User[]>(() => this._rows().map(usuarioRowToUser));
  readonly activos = computed(() => this._rows().filter((u) => u.estado_usuario).length);
  readonly administradores = computed(() => this._rows().filter((u) => u.admin_usuario).length);
  readonly operativos = computed(() => this._rows().filter((u) => !u.admin_usuario).length);

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set('');
    const { data, error } = await this.supabase
      .from('vw_usuarios')
      .select('*')
      .order('id_usuario', { ascending: true });
    if (error) {
      this._error.set('No se pudieron cargar los usuarios.');
    } else {
      this._rows.set((data ?? []) as UsuarioRow[]);
    }
    this._loading.set(false);
  }

  async create(input: NuevoUsuario): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_crear_usuario', {
      p_nombre: input.nombre_usuario,
      p_correo: input.correo_usuario,
      p_contrasena: input.contrasena_usuario,
      p_area: input.area_usuario,
      p_admin: input.admin_usuario,
      p_estado: input.estado_usuario,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  async update(id: string, input: EdicionUsuario): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_actualizar_usuario', {
      p_id: id,
      p_nombre: input.nombre_usuario,
      p_correo: input.correo_usuario,
      p_area: input.area_usuario,
      p_admin: input.admin_usuario,
      p_estado: input.estado_usuario,
      p_contrasena: input.contrasena_usuario ?? null,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  /** Habilita o deshabilita una cuenta (soft enable/disable). */
  async setEstado(id: string, estado: boolean): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_set_estado_usuario', {
      p_id: id,
      p_estado: estado,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  private rawById(id: string): UsuarioRow | undefined {
    return this._rows().find((u) => u.id_usuario === id);
  }

  /** Fila cruda para precargar el formulario de edición. */
  byId(id: string): UsuarioRow | undefined {
    return this.rawById(id);
  }

  private friendly(error: PostgrestError): string {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      return 'Ese correo ya está registrado por otra cuenta.';
    }
    return 'No se pudo guardar el usuario. Intenta de nuevo.';
  }
}
