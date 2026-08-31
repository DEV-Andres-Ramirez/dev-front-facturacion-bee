import { Injectable, computed, inject } from '@angular/core';
import { PeriodDataset, PermissionRow } from '../models';
import { EMPTY_DATASET } from '../data/empty-period.dataset';
import { PERMISSION_MATRIX } from '../data/system.seed';
import { PeriodStore } from './period.store';

/**
 * Fuente de datos de los módulos que aún no están conectados a Supabase
 * (dashboard, conciliación y registros). Entrega el dataset en blanco
 * del periodo; cada módulo se irá reemplazando por datos reales sin cambiar las
 * pantallas. Los módulos del ciclo (carga → entrega) ya leen de Supabase vía
 * `DocumentosService` y no pasan por aquí, y la auditoría lee de la tabla
 * `auditoria` vía `AuditoriaService`.
 */
@Injectable({ providedIn: 'root' })
export class BillingDataService {
  private readonly periodStore = inject(PeriodStore);

  /** Matriz de permisos por rol: configuración del sistema, independiente del periodo. */
  readonly permissions: readonly PermissionRow[] = PERMISSION_MATRIX;

  /** Dataset del periodo activo (en blanco hasta conectar cada módulo). */
  readonly dataset = computed<PeriodDataset>(() => {
    this.periodStore.period();
    return EMPTY_DATASET;
  });

  readonly invoices = computed(() => this.dataset().invoices);
  readonly dashboard = computed(() => this.dataset().dashboard);
  readonly reconciliation = computed(() => this.dataset().reconciliation);
  readonly archive = computed(() => this.dataset().archive);

  /** `true` cuando el periodo no tiene proceso iniciado (estado en blanco). */
  readonly isBlankPeriod = computed(
    () => this.dataset().invoices.length === 0 && this.dataset().loading.status === null,
  );
}
