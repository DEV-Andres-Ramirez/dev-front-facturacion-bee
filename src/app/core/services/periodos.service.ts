import { Injectable, computed, inject, signal } from '@angular/core';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  EtapaCiclo,
  PeriodoId,
  PeriodoRow,
  etiquetaDePeriodo,
  ordenEtapa,
} from '../models';
import { SupabaseService } from './supabase.service';

/** Resultado de una operación de escritura. */
export interface OpResult {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Catálogo de periodos y estado del ciclo de facturación.
 *
 * Sustituye al antiguo `ProcesoStore`, que guardaba las compuertas en el
 * `localStorage` de cada navegador: allí el avance era por dispositivo, no se
 * compartía entre usuarios y se podía saltar desde las herramientas del
 * navegador. Ahora vive en la tabla `periodos`.
 */
@Injectable({ providedIn: 'root' })
export class PeriodosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _rows = signal<PeriodoRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Ya vienen ordenados del más reciente al más antiguo desde la base de datos. */
  readonly periodos = computed(() => this._rows());

  /** Carga el catálogo. Es lo primero que necesita el encabezado. */
  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set('');
    const { data, error } = await this.supabase.rpc('fn_listar_periodos');
    if (error) {
      this._error.set('No se pudieron cargar los periodos.');
    } else {
      this._rows.set((data ?? []) as PeriodoRow[]);
    }
    this._loading.set(false);
  }

  byId(id: PeriodoId): PeriodoRow | undefined {
    return this._rows().find((p) => p.id_periodo === id);
  }

  /** ¿Existe ya el periodo de ese año y mes? */
  existe(anio: number, mes: number): boolean {
    return this._rows().some((p) => p.anio_periodo === anio && p.mes_periodo === mes);
  }

  async crear(anio: number, mes: number, usuario?: string): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_crear_periodo', {
      p_anio: anio,
      p_mes: mes,
      p_usuario: usuario ?? null,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  /**
   * Marca que el periodo llegó a una etapa. La base de datos ignora los
   * retrocesos, de modo que confirmar dos veces un módulo no devuelve el
   * periodo a una etapa anterior.
   */
  async avanzar(id: PeriodoId, etapa: EtapaCiclo): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_avanzar_etapa', {
      p_id: id,
      p_etapa: etapa,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  /** Devuelve el periodo a una etapa anterior. Solo administradores, con motivo. */
  async reabrir(id: PeriodoId, etapa: EtapaCiclo, motivo: string): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_reabrir_etapa', {
      p_id: id,
      p_etapa: etapa,
      p_motivo: motivo,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load();
    return { ok: true };
  }

  /** ¿El periodo ya superó (o está en) una etapa dada? */
  alcanzo(id: PeriodoId, etapa: EtapaCiclo): boolean {
    const periodo = this.byId(id);
    if (!periodo) return false;
    return ordenEtapa(periodo.etapa_periodo) >= ordenEtapa(etapa);
  }

  /** ¿El periodo dejó atrás una etapa? Es la compuerta «ya se confirmó el paso». */
  supero(id: PeriodoId, etapa: EtapaCiclo): boolean {
    const periodo = this.byId(id);
    if (!periodo) return false;
    return ordenEtapa(periodo.etapa_periodo) > ordenEtapa(etapa);
  }

  /** Etiqueta legible de un año y mes, para los mensajes de confirmación. */
  etiqueta(anio: number, mes: number): string {
    return etiquetaDePeriodo(anio, mes);
  }

  private friendly(error: PostgrestError): string {
    // Las funciones lanzan mensajes ya redactados en español («El periodo
    // Septiembre 2026 ya está creado.»); se prefieren al texto genérico.
    return error.message || 'No se pudo completar la operación sobre el periodo.';
  }
}
