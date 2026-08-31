import { Injectable, computed, inject, signal } from '@angular/core';
import type { PostgrestError } from '@supabase/supabase-js';
import { FacturaRow, RegistroPago } from '../models';
import { SupabaseService } from './supabase.service';

/** Resultado de una operación de escritura. */
export interface OpResult {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Facturas del periodo: estado, entrega y conciliación.
 *
 * La factura es ahora una entidad propia (tabla `facturas`) y no el resultado de
 * agrupar líneas del registro interno. Aquí viven su anulación, su fecha de
 * envío y su pago, que antes no tenían dónde guardarse.
 */
@Injectable({ providedIn: 'root' })
export class FacturasService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _rows = signal<FacturaRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Las anuladas no cuentan para entregar ni para los totales del periodo. */
  readonly vigentes = computed(() =>
    this._rows().filter((f) => f.estado_factura !== 'anulada'),
  );
  readonly anuladas = computed(() =>
    this._rows().filter((f) => f.estado_factura === 'anulada'),
  );
  readonly pagadas = computed(() =>
    this._rows().filter((f) => f.estado_factura === 'pagada'),
  );
  readonly enviadas = computed(() =>
    this._rows().filter((f) => f.estado_factura === 'enviada'),
  );
  readonly porEnviar = computed(() =>
    this._rows().filter((f) => f.estado_factura === 'emitida'),
  );
  readonly vencidas = computed(() => this._rows().filter((f) => f.vencida));

  /** Índice por secuencial, para cruzar con el registro interno. */
  readonly porSecuencial = computed(
    () => new Map(this._rows().map((f) => [f.secuencial_factura, f])),
  );

  async load(periodo: string): Promise<void> {
    this._loading.set(true);
    this._error.set('');
    const { data, error } = await this.supabase.rpc('fn_listar_facturas', {
      p_periodo: periodo,
    });
    if (error) {
      this._error.set('No se pudieron cargar las facturas del periodo.');
    } else {
      this._rows.set((data ?? []) as FacturaRow[]);
    }
    this._loading.set(false);
  }

  /**
   * Crea las facturas que falten y actualiza los importes de las que no estén
   * anuladas ni pagadas. Se llama tras cargar o reemplazar el registro interno.
   */
  async sincronizar(periodo: string): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_sincronizar_facturas', {
      p_periodo: periodo,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load(periodo);
    return { ok: true };
  }

  async anular(
    periodo: string,
    secuencial: string,
    motivo: string,
    usuario?: string,
  ): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_anular_factura', {
      p_periodo: periodo,
      p_secuencial: secuencial,
      p_motivo: motivo,
      p_usuario: usuario ?? null,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load(periodo);
    return { ok: true };
  }

  /**
   * Deja constancia de que la factura salió hacia el cliente (RF-ENV-03).
   * La fecha de envío es lo que después alimenta el cálculo de días para pago.
   */
  async marcarEnviada(periodo: string, secuencial: string): Promise<void> {
    await this.supabase.rpc('fn_marcar_enviada', {
      p_periodo: periodo,
      p_secuencial: secuencial,
    });
  }

  /** Registra el pago recibido; la retención y el equivalente COP los calcula la BD. */
  async registrarPago(
    periodo: string,
    secuencial: string,
    pago: RegistroPago,
  ): Promise<OpResult> {
    const { error } = await this.supabase.rpc('fn_registrar_pago', {
      p_periodo: periodo,
      p_secuencial: secuencial,
      p_fecha_pago: pago.fechaPago,
      p_valor_recibido: pago.valorRecibido,
      p_trm: pago.trm,
      p_retencion_pct: pago.retencionPct ?? null,
      p_soporte: pago.soporte ?? null,
    });
    if (error) return { ok: false, error: this.friendly(error) };
    await this.load(periodo);
    return { ok: true };
  }

  private friendly(error: PostgrestError): string {
    // Las funciones lanzan mensajes ya redactados en español.
    return error.message || 'No se pudo completar la operación sobre la factura.';
  }
}
