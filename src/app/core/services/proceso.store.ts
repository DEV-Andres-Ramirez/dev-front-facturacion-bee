import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'bee.proceso';

/** Pasos del ciclo que actúan como compuerta del siguiente módulo. */
export type PasoProceso = 'validado' | 'emitido' | 'revisado';

/**
 * Avance del ciclo por periodo. Cada paso confirmado habilita el módulo
 * siguiente (Validar → Agrupar → Revisar → Entregar). Por ahora persiste en el
 * dispositivo (localStorage); al adoptar backend de proceso se reemplaza por la
 * BD sin cambiar las pantallas.
 */
@Injectable({ providedIn: 'root' })
export class ProcesoStore {
  private readonly _pasos = signal<Record<string, boolean>>(this.read());

  /** `true` si el periodo ya completó el paso indicado. */
  tiene(periodId: string, paso: PasoProceso): boolean {
    return this._pasos()[this.clave(periodId, paso)] === true;
  }

  /** Marca un paso como completado (habilita el módulo siguiente). */
  marcar(periodId: string, paso: PasoProceso): void {
    this._pasos.update((map) => ({ ...map, [this.clave(periodId, paso)]: true }));
    this.persist();
  }

  /** Revierte un paso (p. ej. al recargar documentos que invalidan el avance). */
  reiniciar(periodId: string, paso: PasoProceso): void {
    this._pasos.update((map) => {
      const next = { ...map };
      delete next[this.clave(periodId, paso)];
      return next;
    });
    this.persist();
  }

  private clave(periodId: string, paso: PasoProceso): string {
    return `${periodId}:${paso}`;
  }

  private read(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._pasos()));
  }
}
