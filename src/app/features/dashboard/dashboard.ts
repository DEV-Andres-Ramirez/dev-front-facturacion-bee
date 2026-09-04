import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentosService } from '@core/services/documentos.service';
import { FacturasService } from '@core/services/facturas.service';
import { ParametrosService } from '@core/services/parametros.service';
import { PeriodStore } from '@core/services/period.store';
import { PeriodosService } from '@core/services/periodos.service';
import { FacturaRow, Kpi, PRESENTACION_ESTADO } from '@core/models';
import { montoACentavos } from '@core/utils/monto.util';
import {
  BadgeComponent,
  BarrasComponent,
  CicloComponent,
  DonutComponent,
  EmptyStateComponent,
  IconComponent,
  KpiCardComponent,
  Porcion,
  PuntoSerie,
  SerieComponent,
} from '@shared/ui';

/** Aviso accionable del tablero (RF-DSH-03). */
interface Alerta {
  readonly titulo: string;
  readonly detalle: string;
  readonly tono: 'warn' | 'bad' | 'info';
  readonly icono: string;
  readonly ruta: string;
}

const FMT = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FMT_COP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Tablero de control del periodo (RF-DSH). */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    KpiCardComponent,
    BadgeComponent,
    BarrasComponent,
    CicloComponent,
    DonutComponent,
    EmptyStateComponent,
    IconComponent,
    SerieComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  protected readonly periodStore = inject(PeriodStore);
  private readonly facturas = inject(FacturasService);
  private readonly documentos = inject(DocumentosService);
  private readonly parametros = inject(ParametrosService);
  private readonly periodos = inject(PeriodosService);

  protected readonly periodLabel = this.periodStore.label;
  protected readonly periodShort = this.periodStore.shortLabel;
  protected readonly loading = this.facturas.loading;
  protected readonly estadoDe = PRESENTACION_ESTADO;

  constructor() {
    effect(() => {
      const label = this.periodStore.label();
      if (!label) return;
      void this.facturas.load(label);
      void this.documentos.loadPeriodo(label);
      // La evolución no depende del periodo activo, pero sí de que las facturas
      // estén sincronizadas: recargarla aquí la mantiene al día sin un effect
      // aparte que dispararía otra consulta al abrir cualquier pantalla.
      void this.periodos.cargarResumen();
    });
  }

  // ── Datos base ──────────────────────────────────────────────────────────────

  private readonly todas = this.facturas.rows;
  /** Las anuladas no suman en ningún total del periodo. */
  private readonly vigentes = this.facturas.vigentes;

  protected readonly hayDatos = computed(() => this.todas().length > 0);
  protected readonly sinIniciar = computed(
    () => this.todas().length === 0 && this.documentos.registro().length === 0,
  );

  // ── Indicadores del ciclo (RF-DSH-01) ──────────────────────────────────────

  private readonly totalFacturado = computed(() =>
    this.vigentes().reduce(
      (suma, f) => suma + (f.monto_emitido_factura ?? f.monto_facturado_factura ?? 0),
      0,
    ),
  );
  private readonly totalCobrado = computed(() =>
    this.facturas.pagadas().reduce((suma, f) => suma + (f.valor_recibido_factura ?? 0), 0),
  );
  private readonly totalRetenido = computed(() =>
    this.facturas.pagadas().reduce((suma, f) => suma + (f.valor_retenido_factura ?? 0), 0),
  );
  private readonly totalCop = computed(() =>
    this.facturas.pagadas().reduce((suma, f) => suma + (f.equivalente_cop_factura ?? 0), 0),
  );

  protected readonly porCobrar = computed(() => this.totalFacturado() - this.totalCobrado());

  /** Media de días entre el envío y el pago, solo sobre lo ya cobrado. */
  protected readonly diasPromedio = computed(() => {
    const conDias = this.facturas.pagadas().filter((f) => f.dias_transcurridos !== null);
    if (conDias.length === 0) return null;
    const suma = conDias.reduce((total, f) => total + (f.dias_transcurridos ?? 0), 0);
    return Math.round(suma / conDias.length);
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const vigentes = this.vigentes();
    const pagadas = this.facturas.pagadas().length;
    const enviadas = this.facturas.enviadas().length;
    const sinEmitir = vigentes.filter((f) => f.monto_emitido_factura === null).length;
    const dias = this.diasPromedio();

    return [
      {
        label: 'Total facturas',
        value: String(vigentes.length),
        caption: this.facturas.anuladas().length
          ? `${this.facturas.anuladas().length} anulada(s) excluida(s)`
          : `Periodo · ${this.periodLabel()}`,
        tone: 'primary',
        icon: 'file-stack',
      },
      {
        label: 'Pagadas',
        value: String(pagadas),
        caption: vigentes.length
          ? `${Math.round((pagadas / vigentes.length) * 100)}% del total · conciliadas`
          : 'Sin facturas',
        tone: pagadas > 0 ? 'ok' : 'neutral',
        icon: 'check',
      },
      {
        label: 'Pendientes de cobro',
        value: String(enviadas),
        caption: this.facturas.vencidas().length
          ? `${this.facturas.vencidas().length} fuera de plazo`
          : 'Dentro del plazo acordado',
        tone: this.facturas.vencidas().length ? 'bad' : 'info',
        icon: 'clock',
      },
      {
        label: 'Sin emitir',
        value: String(sinEmitir),
        caption: sinEmitir ? 'Falta el monto o el PDF' : 'Todo emitido',
        tone: sinEmitir ? 'warn' : 'ok',
        icon: 'alert',
      },
      {
        label: 'Total facturado',
        value: `USD ${FMT.format(this.totalFacturado())}`,
        caption: 'Suma de las facturas vigentes',
        tone: 'neutral',
        icon: 'coins',
      },
      {
        label: 'Cobrado',
        value: `USD ${FMT.format(this.totalCobrado())}`,
        caption: `Equivalente $ ${FMT_COP.format(this.totalCop())} COP`,
        tone: this.totalCobrado() > 0 ? 'ok' : 'neutral',
        icon: 'trend',
      },
      {
        label: 'Por cobrar',
        value: `USD ${FMT.format(this.porCobrar())}`,
        caption: 'Facturado menos recibido',
        tone: this.porCobrar() > 0 ? 'warn' : 'ok',
        icon: 'send',
      },
      {
        label: 'Tiempo de cobro',
        value: dias === null ? '—' : `${dias} d`,
        caption: `Del envío al pago · meta ${this.parametros.numero('plazo_pago_dias')} días`,
        tone: dias !== null && dias > this.parametros.numero('plazo_pago_dias') ? 'bad' : 'info',
        icon: 'clock',
      },
    ];
  });

  // ── Avance de cobro y reparto por estado ───────────────────────────────────

  protected readonly avanceCobro = computed(() => {
    const facturado = this.totalFacturado();
    if (facturado <= 0) return 0;
    return Math.min(100, Math.round((this.totalCobrado() / facturado) * 100));
  });

  protected readonly retencion = computed(() => this.totalRetenido());
  protected readonly equivalenteCop = computed(() => this.totalCop());

  /** Reparto por estado, para el gráfico de barras apiladas. */
  protected readonly reparto = computed<Porcion[]>(() => {
    const todas = this.todas();
    const cuenta = (estado: string): number =>
      todas.filter((f) => f.estado_factura === estado).length;

    return [
      { etiqueta: 'Pagadas', valor: cuenta('pagada'), color: 'var(--ok)' },
      { etiqueta: 'Enviadas', valor: cuenta('enviada'), color: 'var(--info)' },
      { etiqueta: 'Emitidas', valor: cuenta('emitida'), color: 'var(--honey)' },
      { etiqueta: 'Anuladas', valor: cuenta('anulada'), color: 'var(--bad)' },
    ].filter((porcion) => porcion.valor > 0);
  });

  /**
   * Antigüedad de lo que está por cobrar. `dias_transcurridos` lo calcula la
   * base de datos desde el envío y hasta ahora no se estaba usando para nada:
   * es el dato que dice si un cobro se está enfriando.
   */
  protected readonly antiguedad = computed<Porcion[]>(() => {
    const porCobrar = this.facturas.rows().filter((f) => f.estado_factura === 'enviada');
    const enTramo = (desde: number, hasta: number): number =>
      porCobrar.filter((f) => {
        const dias = f.dias_transcurridos ?? 0;
        return dias >= desde && dias <= hasta;
      }).length;

    return [
      { etiqueta: 'Hasta 30 días', valor: enTramo(0, 30), color: 'var(--ok)' },
      { etiqueta: 'De 31 a 60 días', valor: enTramo(31, 60), color: 'var(--honey-600)' },
      { etiqueta: 'Más de 60 días', valor: enTramo(61, 100000), color: 'var(--bad)' },
    ].map((tramo) => ({ ...tramo, detalle: `${tramo.valor} factura(s)` }));
  });

  protected readonly hayPorCobrar = computed(() =>
    this.antiguedad().some((tramo) => tramo.valor > 0),
  );

  /** Evolución entre periodos: la única vista que cruza meses. */
  protected readonly evolucion = computed<PuntoSerie[]>(() =>
    this.periodos
      .resumen()
      .filter((r) => r.total_facturas > 0)
      .map((r) => ({
        etiqueta: r.etiqueta_corta_periodo,
        valor: Number(r.facturado),
        detalle: `USD ${FMT.format(Number(r.facturado))} · ${r.total_facturas} factura(s)`,
      })),
  );

  protected readonly hayEvolucion = computed(() => this.evolucion().length >= 2);

  // ── Avance del ciclo ────────────────────────────────────────────────────────

  /** El avance lo pinta `bee-ciclo`; el tablero solo aporta la etapa. */
  protected readonly etapa = this.periodStore.etapa;

  // ── Top de proyectos y colaboradores ───────────────────────────────────────

  /** Los cinco proyectos que más facturan, según la prefactura aprobada. */
  protected readonly topProyectos = computed(() => {
    const acumulado = new Map<string, number>();
    for (const p of this.documentos.prefactura()) {
      const nombre = (p.nombre_proyecto_prefactura ?? '').trim() || 'Sin proyecto';
      acumulado.set(
        nombre,
        (acumulado.get(nombre) ?? 0) + montoACentavos(p.monto_facturar_prefactura),
      );
    }
    const total = [...acumulado.values()].reduce((s, v) => s + v, 0);
    return [...acumulado.entries()]
      .map(([nombre, cents]) => ({
        nombre,
        monto: cents / 100,
        porcentaje: total > 0 ? Math.round((cents / total) * 100) : 0,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  });

  protected readonly proyectosBarras = computed<Porcion[]>(() =>
    this.topProyectos().map((proyecto) => ({
      etiqueta: proyecto.nombre,
      valor: proyecto.monto,
      color: 'var(--info)',
      detalle: `USD ${FMT.format(proyecto.monto)}`,
    })),
  );

  protected readonly totalColaboradores = computed(
    () =>
      new Set(
        this.documentos
          .prefactura()
          .map((p) => (p.id_colaborador_prefactura ?? '').trim())
          .filter(Boolean),
      ).size,
  );

  // ── Alertas accionables (RF-DSH-03) ────────────────────────────────────────

  protected readonly alertas = computed<Alerta[]>(() => {
    const avisos: Alerta[] = [];
    const vencidas = this.facturas.vencidas();
    if (vencidas.length) {
      avisos.push({
        titulo: `${vencidas.length} factura(s) vencida(s)`,
        detalle: `Sin pago pasados los ${this.parametros.numero('plazo_pago_dias')} días acordados.`,
        tono: 'bad',
        icono: 'clock',
        ruta: 'conciliar',
      });
    }

    const sinEmitir = this.vigentes().filter((f) => f.monto_emitido_factura === null);
    if (sinEmitir.length) {
      avisos.push({
        titulo: `${sinEmitir.length} factura(s) sin datos de emisión`,
        detalle: 'Falta el monto emitido o el PDF de la Factura BEE.',
        tono: 'warn',
        icono: 'alert',
        ruta: 'revisar',
      });
    }

    const porEnviar = this.facturas.porEnviar();
    if (porEnviar.length && this.periodStore.alcanzo('entrega')) {
      avisos.push({
        titulo: `${porEnviar.length} factura(s) por entregar`,
        detalle: 'El periodo ya está en la etapa de entrega.',
        tono: 'warn',
        icono: 'send',
        ruta: 'entregar',
      });
    }

    const sinConciliar = this.facturas.enviadas().filter((f) => !f.vencida);
    if (sinConciliar.length) {
      avisos.push({
        titulo: `${sinConciliar.length} pago(s) por conciliar`,
        detalle: 'Facturas enviadas y aún dentro del plazo de cobro.',
        tono: 'info',
        icono: 'coins',
        ruta: 'conciliar',
      });
    }

    return avisos;
  });

  // ── Tabla de facturas ──────────────────────────────────────────────────────

  protected readonly todasLasFacturas = this.todas;
  protected readonly verTodas = signal(false);

  /** La tabla muestra 8 filas y se despliega bajo demanda. */
  protected readonly facturasVisibles = computed(() =>
    this.verTodas() ? this.todas() : this.todas().slice(0, 8),
  );

  protected alternarVerTodas(): void {
    this.verTodas.update((v) => !v);
  }

  protected readonly totalCobradoVista = this.totalCobrado;
  protected readonly retencionPct = computed(() => this.parametros.numero('retencion_pct'));
  protected readonly plazoPago = computed(() => this.parametros.numero('plazo_pago_dias'));

  // ── Ayudas de presentación ─────────────────────────────────────────────────

  protected usd(valor: number | null): string {
    return valor === null ? '—' : `USD ${FMT.format(valor)}`;
  }

  protected cop(valor: number): string {
    return `$ ${FMT_COP.format(valor)}`;
  }

  protected montoDe(factura: FacturaRow): number {
    return factura.monto_emitido_factura ?? factura.monto_facturado_factura ?? 0;
  }

  protected tonoIcono(tono: string): string {
    return tono === 'warn' ? 'ic-honey' : `ic-${tono}`;
  }
}
