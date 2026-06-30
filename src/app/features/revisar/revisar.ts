import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { ProcesoStore } from '@core/services/proceso.store';
import { formatCentavos, montoACentavos } from '@core/utils/monto.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { RevisarDemo } from './revisar-demo';

interface FacturaRevisar {
  readonly secuencial: string;
  readonly pedido: string;
  readonly pedidoUrl: string | null;
  readonly cliente: string;
  readonly moneda: string;
  readonly talentos: number;
  readonly esperadoCents: number;
  readonly montoEmitido: string;
  readonly fecha: string;
  readonly facturaBeeUrl: string | null;
}

const DEMO_PERIOD = '2026-05';
const SIN_SECUENCIAL = 'Sin secuencial';

/**
 * Revisar Facturas (RF-REV). Toma como base `registro_facturacion_interna`
 * agrupado por factura (secuencial). Por cada factura permite cargar la Factura
 * BEE y registrar monto emitido y fecha, que se guardan para todos sus talentos,
 * y compara el monto emitido contra el monto esperado. Mayo 2026 usa el demo.
 */
@Component({
  selector: 'app-revisar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent, RevisarDemo],
  templateUrl: './revisar.html',
})
export class Revisar {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly proceso = inject(ProcesoStore);
  private readonly router = inject(Router);

  protected readonly isDemo = computed(() => this.periodStore.period() === DEMO_PERIOD);
  protected readonly loading = this.documentos.loading;
  protected readonly money = formatCentavos;

  private readonly registro = this.documentos.registro;

  protected readonly hayDatos = computed(() => this.registro().length > 0);
  protected readonly emitido = computed(() => this.proceso.tiene(this.periodStore.period(), 'emitido'));

  protected readonly ediciones = signal<Record<string, { monto?: string; fecha?: string }>>({});
  protected readonly staged = signal<Record<string, File>>({});
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly confirmContinuar = signal(false);

  protected readonly facturas = computed<FacturaRevisar[]>(() => {
    const grupos = new Map<string, FacturaRevisar>();
    const acc = new Map<string, { esperado: number; talentos: number }>();
    for (const r of this.registro()) {
      const sec = (r.secuencial_facturacion_interna ?? '').trim() || SIN_SECUENCIAL;
      const a = acc.get(sec) ?? { esperado: 0, talentos: 0 };
      a.esperado += montoACentavos(r.monto_facturar_facturacion_interna);
      a.talentos += 1;
      acc.set(sec, a);
      if (!grupos.has(sec)) {
        grupos.set(sec, {
          secuencial: sec,
          pedido: (r.pedido_compra_facturacion_interna ?? '').trim() || 'NO RECIBIDO',
          pedidoUrl: r.documento_pedido_compra,
          cliente: r.cliente_facturacion_interna ?? '—',
          moneda: r.tipo_moneda_facturacion_interna ?? 'USD',
          talentos: 0,
          esperadoCents: 0,
          montoEmitido: r.monto_emitido_factura_bee ?? '',
          fecha: r.fecha_factura_bee ?? '',
          facturaBeeUrl: r.documento_factura_bee,
        });
      }
    }
    return [...grupos.values()]
      .map((f) => ({ ...f, esperadoCents: acc.get(f.secuencial)!.esperado, talentos: acc.get(f.secuencial)!.talentos }))
      .sort((a, b) => a.secuencial.localeCompare(b.secuencial, undefined, { numeric: true }));
  });

  private readonly facturasMap = computed(() => new Map(this.facturas().map((f) => [f.secuencial, f])));

  protected readonly resumen = computed(() => {
    const fs = this.facturas();
    const conDocumento = fs.filter((f) => f.facturaBeeUrl || this.staged()[f.secuencial]).length;
    const cuadran = fs.filter((f) => this.cotejo(f.secuencial) === 'coincide').length;
    const totalEsperado = fs.reduce((s, f) => s + f.esperadoCents, 0);
    return { facturas: fs.length, conDocumento, cuadran, totalEsperado };
  });

  protected readonly hayCambios = computed(() => {
    if (Object.keys(this.staged()).length > 0) return true;
    const ed = this.ediciones();
    return Object.keys(ed).some((sec) => {
      const f = this.facturasMap().get(sec);
      return (ed[sec].monto !== undefined && ed[sec].monto !== f?.montoEmitido) ||
        (ed[sec].fecha !== undefined && ed[sec].fecha !== f?.fecha);
    });
  });

  constructor() {
    effect(() => {
      const id = this.periodStore.period();
      const label = this.periodStore.current().label;
      this.ediciones.set({});
      this.staged.set({});
      this.saveError.set('');
      this.confirmContinuar.set(false);
      if (id === DEMO_PERIOD) return;
      void this.documentos.loadPeriodo(label);
    });
  }

  // ── Valores editables por factura ────────────────────────────────────────────
  protected montoValue(sec: string): string {
    return this.ediciones()[sec]?.monto ?? this.facturasMap().get(sec)?.montoEmitido ?? '';
  }

  protected fechaValue(sec: string): string {
    return this.ediciones()[sec]?.fecha ?? this.facturasMap().get(sec)?.fecha ?? '';
  }

  protected stagedNombre(sec: string): string | null {
    return this.staged()[sec]?.name ?? null;
  }

  protected setMonto(sec: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.ediciones.update((e) => ({ ...e, [sec]: { ...e[sec], monto: value } }));
  }

  protected setFecha(sec: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.ediciones.update((e) => ({ ...e, [sec]: { ...e[sec], fecha: value } }));
  }

  protected onFactura(sec: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.staged.update((s) => ({ ...s, [sec]: file }));
  }

  /** Cotejo del monto emitido contra el esperado de la factura. */
  protected cotejo(sec: string): 'coincide' | 'diferencia' | 'pendiente' {
    const monto = this.montoValue(sec).trim();
    if (!monto) return 'pendiente';
    const f = this.facturasMap().get(sec);
    return montoACentavos(monto) === (f?.esperadoCents ?? 0) ? 'coincide' : 'diferencia';
  }

  // ── Guardado ─────────────────────────────────────────────────────────────────
  protected async guardar(): Promise<void> {
    if (this.saving() || !this.hayCambios()) return;
    this.saving.set(true);
    this.saveError.set('');
    const periodId = this.periodStore.period();
    const periodo = this.periodStore.current().label;
    const errors: string[] = [];

    for (const f of this.facturas()) {
      const sec = f.secuencial;
      const ed = this.ediciones()[sec];
      const file = this.staged()[sec];

      if (ed?.monto !== undefined && ed.monto !== f.montoEmitido) {
        const r = await this.documentos.guardarMontoEmitido(periodo, sec, ed.monto.trim());
        if (!r.ok) errors.push(`Monto ${sec}: ${r.error}`);
      }
      if (ed?.fecha !== undefined && ed.fecha !== f.fecha) {
        const r = await this.documentos.guardarFechaFactura(periodo, sec, ed.fecha);
        if (!r.ok) errors.push(`Fecha ${sec}: ${r.error}`);
      }
      if (file) {
        const r = await this.documentos.guardarFacturaBee(periodId, periodo, sec, file);
        if (!r.ok) errors.push(`Factura ${sec}: ${r.error}`);
      }
    }

    await this.documentos.loadPeriodo(periodo);
    this.ediciones.set({});
    this.staged.set({});
    this.saving.set(false);
    if (errors.length) this.saveError.set(errors.join(' · '));
  }

  // ── Continuar a entrega ───────────────────────────────────────────────────────
  protected continuar(): void {
    this.confirmContinuar.set(true);
  }

  protected cancelarContinuar(): void {
    this.confirmContinuar.set(false);
  }

  protected confirmarContinuar(): void {
    this.proceso.marcar(this.periodStore.period(), 'revisado');
    this.confirmContinuar.set(false);
    void this.router.navigate(['/app', 'entregar']);
  }
}
