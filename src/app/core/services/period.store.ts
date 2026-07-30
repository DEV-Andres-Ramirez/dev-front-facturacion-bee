import { Injectable, computed, signal } from '@angular/core';
import { PeriodId, PeriodOption, PERIODS } from '../models';

/**
 * Estado global del periodo de facturación seleccionado en el encabezado.
 * Todos los periodos operan sobre datos reales persistidos en Supabase.
 */
@Injectable({ providedIn: 'root' })
export class PeriodStore {
  private readonly _period = signal<PeriodId>('2026-08');

  /** Periodo seleccionado (solo lectura). */
  readonly period = this._period.asReadonly();

  /** Catálogo de periodos para el selector. */
  readonly options: readonly PeriodOption[] = PERIODS;

  /** Opción correspondiente al periodo seleccionado. */
  readonly current = computed<PeriodOption>(
    () => PERIODS.find((option) => option.id === this._period()) ?? PERIODS[0],
  );

  setPeriod(id: PeriodId): void {
    this._period.set(id);
  }
}
