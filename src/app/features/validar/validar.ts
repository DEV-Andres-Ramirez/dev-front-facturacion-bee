import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { ProcesoStore } from '@core/services/proceso.store';
import { formatCentavos, montoACentavos } from '@core/utils/monto.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { ValidarDemo } from './validar-demo';

type EstadoFila = 'identico' | 'diferencia' | 'solo_prefactura' | 'solo_registro';
type Filtro = 'todos' | 'diferencias' | 'faltantes';

interface FilaValidacion {
  readonly id: string;
  readonly nombre: string;
  readonly prefacturaCents: number;
  readonly registroCents: number;
  readonly diferenciaCents: number;
  readonly lineasPrefactura: number;
  readonly lineasRegistro: number;
  readonly estado: EstadoFila;
}

const DEMO_PERIOD = '2026-05';

/**
 * Validar información (RF-VAL). Coteja `aprobacion_prefactura` contra
 * `registro_facturacion_interna` por `id_colaborador`, sumando y comparando el
 * monto a facturar al centavo exacto. Para Mayo 2026 delega en `ValidarDemo`.
 */
@Component({
  selector: 'app-validar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent, ValidarDemo],
  templateUrl: './validar.html',
})
export class Validar {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly proceso = inject(ProcesoStore);
  private readonly router = inject(Router);

  protected readonly isDemo = computed(() => this.periodStore.period() === DEMO_PERIOD);
  protected readonly loading = this.documentos.loading;
  protected readonly money = formatCentavos;

  private readonly prefactura = this.documentos.prefactura;
  private readonly registro = this.documentos.registro;

  protected readonly hayDatos = computed(() => this.prefactura().length > 0 && this.registro().length > 0);

  protected readonly filtro = signal<Filtro>('todos');
  protected readonly confirmOpen = signal(false);

  /** Cotejo por colaborador (suma de montos en cada tabla). */
  protected readonly comparacion = computed<FilaValidacion[]>(() => {
    const pref = this.agruparPorColaborador(
      this.prefactura(),
      (r) => r.id_colaborador_prefactura,
      (r) => r.monto_facturar_prefactura,
      (r) => r.nombre_colaborador_prefactura,
    );
    const reg = this.agruparPorColaborador(
      this.registro(),
      (r) => r.id_colaborados_facturacion_interna,
      (r) => r.monto_facturar_facturacion_interna,
      () => null,
    );

    const ids = new Set<string>([...pref.keys(), ...reg.keys()]);
    const filas: FilaValidacion[] = [];
    for (const id of ids) {
      const p = pref.get(id);
      const r = reg.get(id);
      const prefacturaCents = p?.cents ?? 0;
      const registroCents = r?.cents ?? 0;
      let estado: EstadoFila;
      if (p && r) estado = prefacturaCents === registroCents ? 'identico' : 'diferencia';
      else if (p) estado = 'solo_prefactura';
      else estado = 'solo_registro';

      filas.push({
        id,
        nombre: p?.nombre || `ID ${id}`,
        prefacturaCents,
        registroCents,
        diferenciaCents: prefacturaCents - registroCents,
        lineasPrefactura: p?.lineas ?? 0,
        lineasRegistro: r?.lineas ?? 0,
        estado,
      });
    }
    return filas.sort((a, b) => this.peso(a.estado) - this.peso(b.estado) || a.nombre.localeCompare(b.nombre));
  });

  protected readonly filtradas = computed(() => {
    const f = this.filtro();
    return this.comparacion().filter((fila) => {
      if (f === 'diferencias') return fila.estado === 'diferencia';
      if (f === 'faltantes') return fila.estado === 'solo_prefactura' || fila.estado === 'solo_registro';
      return true;
    });
  });

  protected readonly resumen = computed(() => {
    const filas = this.comparacion();
    const coinciden = filas.filter((f) => f.estado === 'identico').length;
    const diferencias = filas.filter((f) => f.estado === 'diferencia').length;
    const faltantes = filas.filter((f) => f.estado === 'solo_prefactura' || f.estado === 'solo_registro').length;
    const totalPref = filas.reduce((s, f) => s + f.prefacturaCents, 0);
    const totalReg = filas.reduce((s, f) => s + f.registroCents, 0);
    return {
      comparados: filas.length,
      coinciden,
      diferencias,
      faltantes,
      totalPref,
      totalReg,
      diferenciaNeta: totalPref - totalReg,
      porcentaje: filas.length ? Math.round((coinciden / filas.length) * 100) : 0,
    };
  });

  constructor() {
    effect(() => {
      const id = this.periodStore.period();
      const label = this.periodStore.current().label;
      this.filtro.set('todos');
      this.confirmOpen.set(false);
      if (id === DEMO_PERIOD) return;
      void this.documentos.loadPeriodo(label);
    });
  }

  protected setFiltro(f: Filtro): void {
    this.filtro.set(f);
  }

  protected validarYContinuar(): void {
    if (this.resumen().diferencias > 0) {
      this.confirmOpen.set(true);
      return;
    }
    this.continuar();
  }

  protected confirmarContinuar(): void {
    this.continuar();
  }

  protected cancelarConfirmacion(): void {
    this.confirmOpen.set(false);
  }

  private continuar(): void {
    this.proceso.marcarValidado(this.periodStore.period());
    this.confirmOpen.set(false);
    void this.router.navigate(['/app', 'agrupar']);
  }

  private peso(estado: EstadoFila): number {
    return { diferencia: 0, solo_prefactura: 1, solo_registro: 2, identico: 3 }[estado];
  }

  private agruparPorColaborador<T>(
    rows: readonly T[],
    idDe: (r: T) => string | null,
    montoDe: (r: T) => string | null,
    nombreDe: (r: T) => string | null,
  ): Map<string, { cents: number; nombre: string | null; lineas: number }> {
    const map = new Map<string, { cents: number; nombre: string | null; lineas: number }>();
    for (const row of rows) {
      const id = (idDe(row) ?? '').trim();
      if (!id) continue;
      const prev = map.get(id) ?? { cents: 0, nombre: null, lineas: 0 };
      map.set(id, {
        cents: prev.cents + montoACentavos(montoDe(row)),
        nombre: prev.nombre ?? nombreDe(row),
        lineas: prev.lineas + 1,
      });
    }
    return map;
  }
}
