import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { ProcesoStore } from '@core/services/proceso.store';
import { RegistroInternaRow } from '@core/models';
import { EmptyStateComponent, IconComponent } from '@shared/ui';
import { EntregarDemo } from './entregar-demo';

interface PlantillaCorreo {
  readonly secuencial: string;
  readonly to: string;
  readonly cc: string[];
  readonly subject: string;
  readonly bodyLines: string[];
}

const DEMO_PERIOD = '2026-05';
const SIN_SECUENCIAL = 'Sin secuencial';
const CORREO_DESTINO = 'facturacion_proveedores@banistmo.com';
const SEGUNDOS_POR_CORREO = 180; // 3 minutos por plantilla (solicitado)

/**
 * Entregar al cliente (RF-ENV). Genera una plantilla de correo por cada factura
 * (secuencial) de `registro_facturacion_interna`, enriquecida con datos de la
 * prefactura por `id_colaborador`, y simula el envío. Mayo 2026 usa el demo.
 */
@Component({
  selector: 'app-entregar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, EntregarDemo],
  templateUrl: './entregar.html',
})
export class Entregar implements OnDestroy {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly proceso = inject(ProcesoStore);

  protected readonly isDemo = computed(() => this.periodStore.period() === DEMO_PERIOD);
  protected readonly periodLabel = computed(() => this.periodStore.current().label);
  private readonly registro = this.documentos.registro;
  private readonly prefactura = this.documentos.prefactura;

  protected readonly hayDatos = computed(() => this.registro().length > 0);
  protected readonly revisado = computed(() => this.proceso.tiene(this.periodStore.period(), 'revisado'));

  /** Datos de la prefactura por id_colaborador (contrato y líder aprobador). */
  private readonly prefacturaPorId = computed(() => {
    const map = new Map<string, { contrato: string | null; lider: string | null }>();
    for (const p of this.prefactura()) {
      const id = (p.id_colaborador_prefactura ?? '').trim();
      if (id && !map.has(id)) {
        map.set(id, { contrato: p.numero_contrato_prefactura, lider: p.lider_aprobador_prefactura });
      }
    }
    return map;
  });

  protected readonly plantillas = computed<PlantillaCorreo[]>(() => {
    const mes = this.periodStore.current().label.split(' ')[0];
    const pref = this.prefacturaPorId();
    const grupos = new Map<string, RegistroInternaRow[]>();
    for (const r of this.registro()) {
      const sec = (r.secuencial_facturacion_interna ?? '').trim() || SIN_SECUENCIAL;
      const lista = grupos.get(sec) ?? [];
      lista.push(r);
      grupos.set(sec, lista);
    }

    const plantillas: PlantillaCorreo[] = [];
    for (const [sec, filas] of grupos) {
      const cc = [...new Set(filas.map((f) => (f.email_aprobador_facturacion_interna ?? '').trim()).filter(Boolean))];
      const pedido = filas.map((f) => (f.pedido_compra_facturacion_interna ?? '').trim()).find((p) => p && p.toUpperCase() !== 'NO RECIBIDO') ?? '';
      const monto = filas.find((f) => f.monto_emitido_factura_bee)?.monto_emitido_factura_bee ?? '';
      const fecha = filas.find((f) => f.fecha_factura_bee)?.fecha_factura_bee ?? '';
      const entidad = filas.find((f) => f.cliente_facturacion_interna)?.cliente_facturacion_interna ?? '';

      let contrato: string | null = null;
      let validador: string | null = null;
      for (const f of filas) {
        const datos = pref.get((f.id_colaborados_facturacion_interna ?? '').trim());
        if (!contrato && datos?.contrato) contrato = datos.contrato;
        if (!validador && datos?.lider) validador = datos.lider;
      }

      const body: string[] = [
        `¡Buen Día! adjunto facturación para el mes de ${mes}`,
        `NUMERO DE FACTURA: ${sec}`,
        `PEDIDO DE COMPRA: ${pedido}`,
        `MONTO: ${monto}`,
      ];
      if (contrato) body.push(`NÚMERO DE CONTRATO: ${contrato}`);
      body.push(`FECHA DE FACTURA FISICA: ${fecha}`);
      if (validador) body.push(`NOMBRE DE USUARIO VALIDADOR: ${validador}`);
      body.push(`ENTIDAD: ${entidad}`);
      body.push('NOMBRE DEL PROVEEDOR: BEE CONSULTORIA Y NEGOCIOS SAS');
      body.push('ITBMS: N/A');

      plantillas.push({ secuencial: sec, to: CORREO_DESTINO, cc, subject: 'Emisión Factura', bodyLines: body });
    }
    return plantillas.sort((a, b) => a.secuencial.localeCompare(b.secuencial, undefined, { numeric: true }));
  });

  // ── Envío simulado ───────────────────────────────────────────────────────────
  protected readonly confirmEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly completado = signal(false);
  protected readonly indice = signal(0);
  protected readonly enviados = signal(0);
  protected readonly segundos = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly total = computed(() => this.plantillas().length);
  protected readonly progreso = computed(() => Math.round((this.segundos() / SEGUNDOS_POR_CORREO) * 100));
  protected readonly restante = computed(() => {
    const seg = Math.max(0, SEGUNDOS_POR_CORREO - this.segundos());
    return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      const id = this.periodStore.period();
      const label = this.periodStore.current().label;
      this.reiniciarEnvio();
      if (id === DEMO_PERIOD) return;
      void this.documentos.loadPeriodo(label);
    });
  }

  protected enviar(): void {
    if (this.total() > 0) this.confirmEnviar.set(true);
  }

  protected cancelarEnviar(): void {
    this.confirmEnviar.set(false);
  }

  protected confirmarEnviar(): void {
    this.confirmEnviar.set(false);
    this.enviando.set(true);
    this.completado.set(false);
    this.indice.set(0);
    this.enviados.set(0);
    this.segundos.set(0);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    this.segundos.update((s) => s + 1);
    if (this.segundos() < SEGUNDOS_POR_CORREO) return;
    this.enviados.update((n) => n + 1);
    if (this.enviados() >= this.total()) {
      this.limpiarTimer();
      this.enviando.set(false);
      this.completado.set(true);
      return;
    }
    this.indice.update((i) => i + 1);
    this.segundos.set(0);
  }

  private reiniciarEnvio(): void {
    this.limpiarTimer();
    this.confirmEnviar.set(false);
    this.enviando.set(false);
    this.completado.set(false);
    this.indice.set(0);
    this.enviados.set(0);
    this.segundos.set(0);
  }

  private limpiarTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  ngOnDestroy(): void {
    this.limpiarTimer();
  }
}
