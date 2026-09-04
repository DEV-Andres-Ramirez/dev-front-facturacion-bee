import { Injectable, computed, inject, signal } from '@angular/core';
import { ClaveParametro, PARAMETROS_POR_DEFECTO, ParametroRow } from '../models';
import { SupabaseService } from './supabase.service';

/**
 * Parámetros de negocio: retención, TRM, destinatarios, plazos.
 *
 * Existe para que esos valores no vivan escritos en el código, como exigen
 * RF-CON-02, RF-ENV-02 y RF-USR-02. El correo del cliente, por ejemplo, estaba
 * hasta ahora como constante dentro del módulo de Entrega.
 */
@Injectable({ providedIn: 'root' })
export class ParametrosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _rows = signal<ParametroRow[]>([]);
  private readonly _cargado = signal(false);

  readonly rows = this._rows.asReadonly();
  readonly cargado = this._cargado.asReadonly();

  private readonly mapa = computed(() => new Map(this._rows().map((p) => [p.clave, p.valor])));

  async load(): Promise<void> {
    const { data, error } = await this.supabase.rpc('fn_listar_parametros');
    if (!error) this._rows.set((data ?? []) as ParametroRow[]);
    this._cargado.set(true);
  }

  /** Valor de texto. Cae al respaldo si la tabla aún no respondió. */
  texto(clave: ClaveParametro): string {
    return this.mapa().get(clave) ?? PARAMETROS_POR_DEFECTO[clave];
  }

  /** Valor numérico. Un valor no numérico cae al respaldo en vez de dar `NaN`. */
  numero(clave: ClaveParametro): number {
    const valor = Number(this.texto(clave).replace(',', '.'));
    return Number.isFinite(valor) ? valor : Number(PARAMETROS_POR_DEFECTO[clave].replace(',', '.'));
  }

  /** Lista de correos separados por coma, ya limpia de vacíos. */
  lista(clave: ClaveParametro): string[] {
    return this.texto(clave)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async guardar(clave: ClaveParametro, valor: string, usuario?: string): Promise<boolean> {
    const { error } = await this.supabase.rpc('fn_guardar_parametro', {
      p_clave: clave,
      p_valor: valor,
      p_usuario: usuario ?? null,
    });
    if (error) return false;
    await this.load();
    return true;
  }
}
