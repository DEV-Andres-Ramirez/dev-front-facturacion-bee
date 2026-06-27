import { Injectable, computed, signal } from '@angular/core';
import { PeriodId, PeriodOption, PERIODS } from '../models';

/**
 * Estado global del periodo de facturación seleccionado en el encabezado.
 * Mayo 2026 abre con datos de ejemplo; Junio 2026 inicia el ciclo desde cero.
 */
@Injectable({ providedIn: 'root' })
export class PeriodStore {
  private readonly _period = signal<PeriodId>('2026-05');

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
