import { Injectable, computed, inject, signal } from '@angular/core';
import { EtapaCiclo, PeriodoId, PeriodoRow, ordenEtapa } from '../models';
import { PeriodosService } from './periodos.service';

const STORAGE_KEY = 'bee.periodo';

/**
 * Periodo de facturación activo.
 *
 * El catálogo ya no está compilado en el código: sale de la tabla `periodos` a
 * través de `PeriodosService`. Este store solo decide **cuál** de ellos se está
 * mirando y lo recuerda entre recargas.
 *
 * Ojo con la doble clave, que es la trampa histórica del proyecto:
 * `period()` devuelve el id (`'2026-08'`), que es el prefijo de las rutas de
 * Storage; `label()` devuelve la etiqueta (`'Agosto 2026'`), que es el valor
 * guardado en todas las columnas `periodo_*` de la base de datos.
 */
@Injectable({ providedIn: 'root' })
export class PeriodStore {
  private readonly periodos = inject(PeriodosService);

  private readonly _period = signal<PeriodoId>(this.restore());

  readonly period = this._period.asReadonly();
  readonly options = this.periodos.periodos;
  readonly loading = this.periodos.loading;

  /**
   * Periodo activo. Si el guardado ya no existe (o aún no cargó el catálogo),
   * cae al más reciente, que es el primero de la lista.
   */
  readonly current = computed<PeriodoRow | null>(() => {
    const lista = this.periodos.periodos();
    if (lista.length === 0) return null;
    return lista.find((p) => p.id_periodo === this._period()) ?? lista[0];
  });

  /** Etiqueta del periodo: la clave real en las columnas `periodo_*`. */
  readonly label = computed(() => this.current()?.etiqueta_periodo ?? '');
  readonly shortLabel = computed(() => this.current()?.etiqueta_corta_periodo ?? '');
  readonly etapa = computed<EtapaCiclo>(() => this.current()?.etapa_periodo ?? 'carga');
  readonly listo = computed(() => this.current() !== null);

  /** Carga el catálogo y ajusta el periodo activo si el guardado ya no existe. */
  async init(): Promise<void> {
    await this.periodos.load();
    const lista = this.periodos.periodos();
    if (lista.length > 0 && !lista.some((p) => p.id_periodo === this._period())) {
      this.setPeriod(lista[0].id_periodo);
    }
  }

  setPeriod(id: PeriodoId): void {
    this._period.set(id);
    this.persist(id);
  }

  /** ¿El periodo activo ya superó esta etapa? Es la compuerta entre módulos. */
  supero(etapa: EtapaCiclo): boolean {
    return ordenEtapa(this.etapa()) > ordenEtapa(etapa);
  }

  /** ¿El periodo activo está en esta etapa o más adelante? */
  alcanzo(etapa: EtapaCiclo): boolean {
    return ordenEtapa(this.etapa()) >= ordenEtapa(etapa);
  }

  private persist(id: PeriodoId): void {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* almacenamiento no disponible: el periodo vive solo en memoria. */
    }
  }

  private restore(): PeriodoId {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }
}
