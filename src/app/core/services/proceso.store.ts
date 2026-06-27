import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'bee.validado';

/**
 * Estado del avance del ciclo por periodo. Por ahora persiste en el dispositivo
 * (localStorage) la confirmación de validación, que es la compuerta para habilitar
 * el módulo de Agrupar. Al adoptar backend de proceso, se reemplaza por la BD sin
 * cambiar las pantallas.
 */
@Injectable({ providedIn: 'root' })
export class ProcesoStore {
  private readonly _validado = signal<Record<string, boolean>>(this.read());

  /** `true` si la información del periodo ya fue validada y confirmada. */
  validado(periodId: string): boolean {
    return this._validado()[periodId] === true;
  }

  /** Marca el periodo como validado (habilita Agrupar). */
  marcarValidado(periodId: string): void {
    this._validado.update((map) => ({ ...map, [periodId]: true }));
    this.persist();
  }

  /** Revierte la validación de un periodo (p. ej. al recargar documentos). */
  reiniciar(periodId: string): void {
    this._validado.update((map) => {
      const next = { ...map };
      delete next[periodId];
      return next;
    });
    this.persist();
  }

  private read(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._validado()));
  }
}
