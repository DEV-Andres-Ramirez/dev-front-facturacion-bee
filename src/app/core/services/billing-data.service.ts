import { Injectable, computed, inject, signal } from '@angular/core';
import { PeriodDataset, PeriodId, PermissionRow, User } from '../models';
import { MAY_2026_DATASET } from '../data/may-2026.dataset';
import { EMPTY_DATASET } from '../data/empty-period.dataset';
import { ABRIL_LOADED_DATASET } from '../data/abril-loaded.dataset';
import { PERMISSION_MATRIX, SYSTEM_USERS } from '../data/system.seed';
import { PeriodStore } from './period.store';

/**
 * Fuente de datos del ciclo de facturación, derivada del periodo seleccionado.
 * En el prototipo sustituye la base de datos transaccional (RNF-DA-01): Mayo 2026
 * entrega datos sembrados y Junio 2026 un dataset en blanco. Cada slice se expone
 * como `computed` para que las pantallas reaccionen al cambio de periodo.
 *
 * `importPrefactura()` simula la carga del Excel del cliente: registra un dataset
 * «override» para el periodo, de modo que un periodo en blanco pase a mostrar la
 * información importada. (Cuando exista backend, este override se reemplaza por
 * la respuesta HTTP — las pantallas no cambian.)
 */
/** Tipo de soporte que puede cargarse en un periodo. */
export type UploadSlot = 'prefactura' | 'pedido' | 'registro' | 'novedades';

/** Estado de carga de los 4 tipos de soporte de un periodo. */
export interface PeriodUploads {
  readonly prefactura: boolean;
  readonly registro: boolean;
  readonly novedades: boolean;
  /** Los pedidos de compra pueden cargarse N veces. */
  readonly pedidos: number;
}

const NO_UPLOADS: PeriodUploads = { prefactura: false, registro: false, novedades: false, pedidos: 0 };

@Injectable({ providedIn: 'root' })
export class BillingDataService {
  private readonly periodStore = inject(PeriodStore);

  /** Datasets importados en tiempo de ejecución, por periodo. */
  private readonly imported = signal<Partial<Record<PeriodId, PeriodDataset>>>({});

  /** Estado de los soportes cargados por periodo. */
  private readonly uploads = signal<Partial<Record<PeriodId, PeriodUploads>>>({});

  /** Cuentas y permisos: configuración del sistema, independiente del periodo. */
  readonly users: readonly User[] = SYSTEM_USERS;
  readonly permissions: readonly PermissionRow[] = PERMISSION_MATRIX;

  /** Dataset completo del periodo activo (override importado o semilla). */
  readonly dataset = computed<PeriodDataset>(() => {
    const id = this.periodStore.period();
    return this.imported()[id] ?? this.datasetFor(id);
  });

  readonly invoices = computed(() => this.dataset().invoices);
  readonly dashboard = computed(() => this.dataset().dashboard);
  readonly loading = computed(() => this.dataset().loading);
  readonly prefactura = computed(() => this.dataset().prefactura);
  readonly validation = computed(() => this.dataset().validation);
  readonly pendingTalents = computed(() => this.dataset().pendingTalents);
  readonly groups = computed(() => this.dataset().groups);
  readonly emittedInvoices = computed(() => this.dataset().emittedInvoices);
  readonly reviewChecks = computed(() => this.dataset().reviewChecks);
  readonly emailDraft = computed(() => this.dataset().emailDraft);
  readonly reconciliation = computed(() => this.dataset().reconciliation);
  readonly archive = computed(() => this.dataset().archive);
  readonly audit = computed(() => this.dataset().audit);

  /** `true` cuando el periodo no tiene proceso iniciado (estado en blanco). */
  readonly isBlankPeriod = computed(
    () => this.dataset().invoices.length === 0 && this.dataset().loading.status === null,
  );

  /** `true` si el periodo activo se cargó importando un archivo (no semilla). */
  readonly isImported = computed(() => this.imported()[this.periodStore.period()] !== undefined);

  /** Soportes cargados del periodo activo (4 tipos de archivo). */
  readonly uploadsForCurrent = computed<PeriodUploads>(
    () => this.uploads()[this.periodStore.period()] ?? NO_UPLOADS,
  );

  /**
   * Registra la carga de un soporte del periodo. Al cargar la prefactura
   * aprobada (origen del ciclo) se importa además el dataset del periodo.
   */
  markUpload(id: PeriodId, slot: UploadSlot): void {
    this.uploads.update((current) => {
      const prev = current[id] ?? NO_UPLOADS;
      const next: PeriodUploads =
        slot === 'pedido' ? { ...prev, pedidos: prev.pedidos + 1 } : { ...prev, [slot]: true };
      return { ...current, [id]: next };
    });
    if (slot === 'prefactura') this.importPrefactura(id);
  }

  /**
   * Simula la importación de la prefactura aprobada del cliente para un periodo.
   * Carga el dataset real de Abril 2026 (evidencias reales · Banistmo).
   */
  importPrefactura(id: PeriodId): void {
    this.imported.update((current) => ({ ...current, [id]: ABRIL_LOADED_DATASET }));
  }

  /** Revierte un periodo a su estado original (descarta lo importado). */
  resetPeriod(id: PeriodId): void {
    this.imported.update((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    this.uploads.update((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  private datasetFor(id: PeriodId): PeriodDataset {
    return id === '2026-05' ? MAY_2026_DATASET : EMPTY_DATASET;
  }
}
