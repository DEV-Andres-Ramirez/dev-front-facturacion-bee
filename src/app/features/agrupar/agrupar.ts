import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { ProcesoStore } from '@core/services/proceso.store';
import { formatCentavos, montoACentavos } from '@core/utils/monto.util';
import { BadgeComponent, EmptyStateComponent } from '@shared/ui';
import { AgruparDemo } from './agrupar-demo';

interface LineaAgrupada {
  readonly id: number;
  readonly idColaborador: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly pedido: string;
  readonly montoCents: number;
}

interface GrupoSecuencial {
  readonly secuencial: string;
  readonly pedido: string;
  readonly cliente: string;
  readonly moneda: string;
  readonly lineas: LineaAgrupada[];
  readonly totalCents: number;
}

const DEMO_PERIOD = '2026-05';
const SIN_SECUENCIAL = 'Sin secuencial';

/**
 * Agrupar información (RF-AGR). Consolida `registro_facturacion_interna` por
 * `secuencial` (las líneas que van en una misma factura) y enriquece cada línea
 * con el nombre del colaborador desde la prefactura (`id_colaborador`). Para
 * Mayo 2026 delega en `AgruparDemo`.
 */
@Component({
  selector: 'app-agrupar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, AgruparDemo],
  templateUrl: './agrupar.html',
})
export class Agrupar {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly proceso = inject(ProcesoStore);

  protected readonly isDemo = computed(() => this.periodStore.period() === DEMO_PERIOD);
  protected readonly loading = this.documentos.loading;
  protected readonly money = formatCentavos;

  private readonly registro = this.documentos.registro;
  private readonly prefactura = this.documentos.prefactura;

  protected readonly hayDatos = computed(() => this.registro().length > 0);
  protected readonly validado = computed(() => this.proceso.validado(this.periodStore.period()));

  /** id_colaborador → nombre, tomado de la prefactura. */
  private readonly nombrePorColaborador = computed(() => {
    const map = new Map<string, string>();
    for (const r of this.prefactura()) {
      const id = (r.id_colaborador_prefactura ?? '').trim();
      if (id && r.nombre_colaborador_prefactura && !map.has(id)) map.set(id, r.nombre_colaborador_prefactura);
    }
    return map;
  });

  protected readonly grupos = computed<GrupoSecuencial[]>(() => {
    const nombres = this.nombrePorColaborador();
    const porSecuencial = new Map<string, LineaAgrupada[]>();
    const meta = new Map<string, { pedido: string; cliente: string; moneda: string }>();

    for (const r of this.registro()) {
      const sec = (r.secuencial_facturacion_interna ?? '').trim() || SIN_SECUENCIAL;
      const id = (r.id_colaborados_facturacion_interna ?? '').trim();
      const linea: LineaAgrupada = {
        id: r.id_facturacion_interna,
        idColaborador: id,
        nombre: nombres.get(id) ?? (id ? `ID ${id}` : '—'),
        descripcion: r.descripcion_facturacion_interna ?? '',
        pedido: (r.pedido_compra_facturacion_interna ?? '').trim() || 'NO RECIBIDO',
        montoCents: montoACentavos(r.monto_facturar_facturacion_interna),
      };
      const lista = porSecuencial.get(sec) ?? [];
      lista.push(linea);
      porSecuencial.set(sec, lista);
      if (!meta.has(sec)) {
        meta.set(sec, {
          pedido: (r.pedido_compra_facturacion_interna ?? '').trim() || 'NO RECIBIDO',
          cliente: r.cliente_facturacion_interna ?? '—',
          moneda: r.tipo_moneda_facturacion_interna ?? '—',
        });
      }
    }

    return [...porSecuencial.entries()]
      .map(([secuencial, lineas]) => ({
        secuencial,
        pedido: meta.get(secuencial)!.pedido,
        cliente: meta.get(secuencial)!.cliente,
        moneda: meta.get(secuencial)!.moneda,
        lineas,
        totalCents: lineas.reduce((s, l) => s + l.montoCents, 0),
      }))
      .sort((a, b) => a.secuencial.localeCompare(b.secuencial, undefined, { numeric: true }));
  });

  protected readonly seleccion = signal<string | null>(null);

  /** Grupo activo para el detalle (el seleccionado o el primero por defecto). */
  protected readonly grupoActivo = computed<GrupoSecuencial | undefined>(() => {
    const sel = this.seleccion();
    const grupos = this.grupos();
    return grupos.find((g) => g.secuencial === sel) ?? grupos[0];
  });

  protected readonly resumen = computed(() => {
    const grupos = this.grupos();
    const lineas = grupos.reduce((s, g) => s + g.lineas.length, 0);
    const total = grupos.reduce((s, g) => s + g.totalCents, 0);
    const pedidos = new Set(
      this.registro()
        .map((r) => (r.pedido_compra_facturacion_interna ?? '').trim())
        .filter((p) => p && p.toUpperCase() !== 'NO RECIBIDO'),
    ).size;
    const consolidados = grupos.filter((g) => g.lineas.length > 1).length;
    return { grupos: grupos.length, lineas, total, pedidos, consolidados };
  });

  constructor() {
    effect(() => {
      const id = this.periodStore.period();
      const label = this.periodStore.current().label;
      this.seleccion.set(null);
      if (id === DEMO_PERIOD) return;
      void this.documentos.loadPeriodo(label);
    });
  }

  protected seleccionar(secuencial: string): void {
    this.seleccion.set(secuencial);
  }
}
