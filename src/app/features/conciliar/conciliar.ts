import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AuditoriaService } from '@core/services/auditoria.service';
import { AuthService } from '@core/services/auth.service';
import { FacturasService } from '@core/services/facturas.service';
import { ParametrosService } from '@core/services/parametros.service';
import { PeriodStore } from '@core/services/period.store';
import { PeriodosService } from '@core/services/periodos.service';
import { FacturaRow, PRESENTACION_ESTADO } from '@core/models';
import { BadgeComponent, EmptyStateComponent, IconComponent, ModalComponent } from '@shared/ui';
import { AnularFacturaDialog } from '@shared/facturas';

type Filtro = 'todas' | 'pendientes' | 'pagadas' | 'vencidas' | 'anuladas';

const FMT = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FMT_COP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/**
 * Conciliación de cuentas (RF-CON).
 *
 * Cuando el banco notifica un ingreso, se registra el pago contra la factura,
 * se aplica la retención vigente y se convierte a pesos con la TRM de esa
 * operación. La retención y el equivalente en COP los calcula la base de datos,
 * de modo que todas las pantallas muestran exactamente la misma cifra.
 */
@Component({
  selector: 'app-conciliar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    IconComponent,
    AnularFacturaDialog,
    ModalComponent,
  ],
  templateUrl: './conciliar.html',
  styleUrl: './conciliar.css',
})
export class Conciliar {
  protected readonly periodStore = inject(PeriodStore);
  private readonly facturas = inject(FacturasService);
  private readonly parametros = inject(ParametrosService);
  private readonly periodos = inject(PeriodosService);
  private readonly auditoria = inject(AuditoriaService);
  private readonly auth = inject(AuthService);

  protected readonly periodLabel = this.periodStore.label;
  protected readonly loading = this.facturas.loading;
  protected readonly estadoDe = PRESENTACION_ESTADO;

  protected readonly filtro = signal<Filtro>('todas');

  constructor() {
    effect(() => {
      const label = this.periodStore.label();
      if (!label) return;
      this.filtro.set('todas');
      this.cerrarPago();
      this.anulando.set(null);
      void this.facturas.load(label);
    });
  }

  // ── Datos ───────────────────────────────────────────────────────────────────

  /** Solo entran en conciliación las facturas que ya salieron hacia el cliente. */
  protected readonly conciliables = computed(() =>
    this.facturas.rows().filter((f) => f.estado_factura !== 'emitida'),
  );

  protected readonly hayDatos = computed(() => this.conciliables().length > 0);

  protected readonly filas = computed<FacturaRow[]>(() => {
    const todas = this.conciliables();
    switch (this.filtro()) {
      case 'pendientes':
        return todas.filter((f) => f.estado_factura === 'enviada');
      case 'pagadas':
        return todas.filter((f) => f.estado_factura === 'pagada');
      case 'vencidas':
        return todas.filter((f) => f.vencida);
      case 'anuladas':
        return todas.filter((f) => f.estado_factura === 'anulada');
      default:
        return todas;
    }
  });

  protected readonly vencidas = computed(() => this.conciliables().filter((f) => f.vencida));

  protected readonly numAnuladas = computed(
    () => this.conciliables().filter((f) => f.estado_factura === 'anulada').length,
  );

  // ── Consolidado del periodo (RF-CON-04) ────────────────────────────────────

  protected readonly totales = computed(() => {
    const vigentes = this.conciliables().filter((f) => f.estado_factura !== 'anulada');
    const pagadas = vigentes.filter((f) => f.estado_factura === 'pagada');

    const facturado = vigentes.reduce(
      (s, f) => s + (f.monto_emitido_factura ?? f.monto_facturado_factura ?? 0),
      0,
    );
    const recibido = pagadas.reduce((s, f) => s + (f.valor_recibido_factura ?? 0), 0);
    const retenido = pagadas.reduce((s, f) => s + (f.valor_retenido_factura ?? 0), 0);
    const cop = pagadas.reduce((s, f) => s + (f.equivalente_cop_factura ?? 0), 0);

    return { facturado, recibido, retenido, cop, pendiente: facturado - recibido };
  });

  protected readonly retencionPct = computed(() => this.parametros.numero('retencion_pct'));
  protected readonly plazoPago = computed(() => this.parametros.numero('plazo_pago_dias'));

  // ── Registro de pago (RF-CON-01 y RF-CON-02) ───────────────────────────────

  protected readonly pagando = signal<FacturaRow | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorPago = signal('');

  protected readonly fechaPago = signal(new Date().toISOString().slice(0, 10));
  protected readonly valorRecibido = signal('');
  protected readonly trm = signal('');
  protected readonly soporte = signal('');

  /** Vista previa del cálculo, con las mismas reglas que aplicará la base de datos. */
  protected readonly previsualizacion = computed(() => {
    const factura = this.pagando();
    if (!factura) return null;
    const base = factura.monto_emitido_factura ?? factura.monto_facturado_factura ?? 0;
    const valor = Number(this.valorRecibido().replace(',', '.'));
    const tasa = Number(this.trm().replace(',', '.'));
    const retenido = (base * this.retencionPct()) / 100;

    return {
      base,
      retenido,
      neto: base - retenido,
      recibido: Number.isFinite(valor) ? valor : 0,
      cop: Number.isFinite(valor) && Number.isFinite(tasa) ? valor * tasa : 0,
      diferencia: (Number.isFinite(valor) ? valor : 0) - (base - retenido),
    };
  });

  protected abrirPago(factura: FacturaRow): void {
    this.pagando.set(factura);
    this.errorPago.set('');
    this.fechaPago.set(new Date().toISOString().slice(0, 10));
    // Se propone el neto esperado y la TRM configurada: en la mayoría de los
    // casos son los valores correctos y solo hay que confirmarlos.
    const base = factura.monto_emitido_factura ?? factura.monto_facturado_factura ?? 0;
    const neto = base - (base * this.retencionPct()) / 100;
    this.valorRecibido.set(neto.toFixed(2));
    this.trm.set(String(this.parametros.numero('trm_defecto')));
    this.soporte.set('');
  }

  protected cerrarPago(): void {
    this.pagando.set(null);
    this.errorPago.set('');
  }

  protected setFechaPago(event: Event): void {
    this.fechaPago.set((event.target as HTMLInputElement).value);
  }
  protected setValorRecibido(event: Event): void {
    this.valorRecibido.set((event.target as HTMLInputElement).value);
  }
  protected setTrm(event: Event): void {
    this.trm.set((event.target as HTMLInputElement).value);
  }
  protected setSoporte(event: Event): void {
    this.soporte.set((event.target as HTMLInputElement).value);
  }

  protected async confirmarPago(): Promise<void> {
    const factura = this.pagando();
    if (!factura) return;

    const valor = Number(this.valorRecibido().replace(',', '.'));
    const tasa = Number(this.trm().replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      this.errorPago.set('Indica un valor recibido mayor que cero.');
      return;
    }
    if (!Number.isFinite(tasa) || tasa <= 0) {
      this.errorPago.set('Indica la TRM aplicada al pago.');
      return;
    }

    this.guardando.set(true);
    const resultado = await this.facturas.registrarPago(
      this.periodLabel(),
      factura.secuencial_factura,
      {
        fechaPago: this.fechaPago(),
        valorRecibido: valor,
        trm: tasa,
        retencionPct: this.retencionPct(),
        soporte: this.soporte().trim() || undefined,
      },
    );
    this.guardando.set(false);

    this.auditoria.registrar({
      modulo: 'Conciliación',
      accion: 'REGISTRAR_PAGO',
      resultado: resultado.ok ? 'exito' : 'error',
      observacion: resultado.ok
        ? `Registró el pago de la factura ${factura.secuencial_factura} por USD ${FMT.format(valor)}.`
        : `No se pudo registrar el pago de la factura ${factura.secuencial_factura}.`,
      entidad: 'factura',
      referencia: factura.secuencial_factura,
      detalle: { valorRecibido: valor, trm: tasa, retencionPct: this.retencionPct() },
    });

    if (!resultado.ok) {
      this.errorPago.set(resultado.error ?? 'No se pudo registrar el pago.');
      return;
    }
    this.cerrarPago();
    void this.avanzarSiTodoConciliado();
  }

  /** Cuando ya no queda nada por cobrar, el periodo pasa a la etapa de archivo. */
  private async avanzarSiTodoConciliado(): Promise<void> {
    const pendientes = this.conciliables().filter((f) => f.estado_factura === 'enviada');
    if (pendientes.length === 0 && this.periodStore.alcanzo('conciliacion')) {
      await this.periodos.avanzar(this.periodStore.period(), 'archivo');
    }
  }

  // ── Presentación ────────────────────────────────────────────────────────────

  /** Fecha corta a partir de un `timestamptz`, para la celda de acciones. */
  protected fecha(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ''
      : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  protected setFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  protected usd(valor: number | null): string {
    return valor === null ? '—' : FMT.format(valor);
  }

  protected cop(valor: number | null): string {
    return valor === null ? '—' : `$ ${FMT_COP.format(valor)}`;
  }

  /** Millones de pesos, para que la tabla no se llene de dígitos. */
  protected copCorto(valor: number | null): string {
    return valor === null ? '—' : `$ ${FMT.format(valor / 1_000_000)} M`;
  }

  protected montoDe(factura: FacturaRow): number {
    return factura.monto_emitido_factura ?? factura.monto_facturado_factura ?? 0;
  }

  /** Color de la barrita lateral, derivado del estado real (RF-CON-03). */
  protected colorEstado(factura: FacturaRow): string {
    if (factura.estado_factura === 'anulada') return 'var(--bad)';
    if (factura.estado_factura === 'pagada') return 'var(--ok)';
    return factura.vencida ? 'var(--bad)' : 'var(--info)';
  }
  // ── Anulación ───────────────────────────────────────────────────────────────

  /**
   * En Conciliar la compuerta **no** puede ser la de Revisar
   * (`!periodStore.supero('revision')`): aquí ya se pasó de largo esa etapa, así
   * que sería siempre falsa. Lo que gobierna aquí es el estado de la factura —la
   * base de datos rechaza anular una pagada— y el rol.
   */
  protected readonly puedeAnular = this.auth.isAdmin;

  protected readonly anulando = signal<FacturaRow | null>(null);

  protected anulable(factura: FacturaRow): boolean {
    return (
      this.puedeAnular() &&
      factura.estado_factura !== 'pagada' &&
      factura.estado_factura !== 'anulada'
    );
  }

  protected pedirAnulacion(factura: FacturaRow): void {
    this.anulando.set(factura);
  }

  protected cancelarAnulacion(): void {
    this.anulando.set(null);
  }

  /**
   * Anular una enviada la saca de las pendientes de cobro, así que el periodo
   * puede haber quedado conciliado del todo justo ahora.
   */
  protected async trasAnular(): Promise<void> {
    this.anulando.set(null);
    await this.avanzarSiTodoConciliado();
  }
}
