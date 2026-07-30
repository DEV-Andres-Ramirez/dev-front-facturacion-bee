import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DocumentosService } from '@core/services/documentos.service';
import { AdjuntoPorUrl, EmailService, esReintentable, mensajeDeError } from '@core/services/email.service';
import { PeriodStore } from '@core/services/period.store';
import { ProcesoStore } from '@core/services/proceso.store';
import { RegistroInternaRow } from '@core/models';
import { escaparHtml } from '@core/utils/html.util';
import { EmptyStateComponent, IconComponent } from '@shared/ui';

interface PlantillaCorreo {
  readonly secuencial: string;
  readonly to: string;
  readonly cc: string[];
  readonly subject: string;
  readonly bodyLines: string[];
  readonly adjuntos: AdjuntoPorUrl[];
}

interface ErrorEnvio {
  readonly secuencial: string;
  readonly motivo: string;
  /** Solo 504 / fallo de red ameritan reintento (tabla de errores de CONSUMO.md). */
  readonly reintentable: boolean;
}

interface AdvertenciaEnvio {
  readonly secuencial: string;
  readonly detalle: string;
}

const SIN_SECUENCIAL = 'Sin secuencial';
const CORREO_DESTINO = 'facturacion_proveedores@banistmo.com';

/**
 * Entregar al cliente (RF-ENV). Genera una plantilla de correo por cada factura
 * (secuencial) de `registro_facturacion_interna`, enriquecida con datos de la
 * prefactura por `id_colaborador`, y la envía por el backend de correo
 * (dev-back-facturacion-bee) con la Factura BEE y el pedido de compra adjuntos
 * desde Supabase Storage.
 */
@Component({
  selector: 'app-entregar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent],
  templateUrl: './entregar.html',
})
export class Entregar {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly proceso = inject(ProcesoStore);
  private readonly email = inject(EmailService);

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

      // Las URLs vienen de Supabase Storage; el backend las descarga y las adjunta.
      const adjuntos: AdjuntoPorUrl[] = [];
      const factura = filas.find((f) => f.documento_factura_bee)?.documento_factura_bee;
      const pedidoDoc = filas.find((f) => f.documento_pedido_compra)?.documento_pedido_compra;
      if (factura) adjuntos.push({ url: factura, filename: `FACTURA ${sec}.pdf` });
      if (pedidoDoc) adjuntos.push({ url: pedidoDoc, filename: `PEDIDO DE COMPRA ${sec}.pdf` });

      plantillas.push({ secuencial: sec, to: CORREO_DESTINO, cc, subject: 'Emisión Factura', bodyLines: body, adjuntos });
    }
    return plantillas.sort((a, b) => a.secuencial.localeCompare(b.secuencial, undefined, { numeric: true }));
  });

  // ── Envío ────────────────────────────────────────────────────────────────────
  protected readonly confirmEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly completado = signal(false);
  protected readonly indice = signal(0);
  protected readonly enviados = signal(0);
  /** Facturas que fallaron, para mostrarlas (y reintentarlas) al terminar. */
  protected readonly errores = signal<ErrorEnvio[]>([]);
  /** Correos entregados con destinatarios descartados por el servidor (no se reintentan). */
  protected readonly advertencias = signal<AdvertenciaEnvio[]>([]);
  /** Secuencial de la plantilla en curso, para el overlay de progreso. */
  protected readonly enviandoSecuencial = signal('');
  protected readonly erroresReintentables = computed(() => this.errores().filter((e) => e.reintentable));

  /**
   * Época del envío: se incrementa al cambiar de periodo o destruir el
   * componente, y el bucle en curso la comprueba tras cada `await` para
   * detenerse en lugar de seguir enviando correos huérfanos.
   */
  private epoch = 0;

  protected readonly total = computed(() => this.plantillas().length);
  protected readonly progreso = computed(() => {
    const total = this.lote().length || 1;
    return Math.round((this.procesadosLote() / total) * 100);
  });

  /** Plantillas del envío en curso (todas, o solo las fallidas al reintentar). */
  private readonly lote = signal<PlantillaCorreo[]>([]);
  private readonly procesadosLote = signal(0);
  protected readonly loteTotal = computed(() => this.lote().length);

  constructor() {
    effect(() => {
      this.periodStore.period();
      const label = this.periodStore.current().label;
      this.reiniciarEnvio();
      void this.documentos.loadPeriodo(label);
    });
    // Detiene el bucle de envío si el usuario abandona la pantalla.
    inject(DestroyRef).onDestroy(() => this.epoch++);
  }

  protected enviar(): void {
    if (this.total() > 0 && !this.enviando()) this.confirmEnviar.set(true);
  }

  protected cancelarEnviar(): void {
    this.confirmEnviar.set(false);
  }

  protected confirmarEnviar(): void {
    this.confirmEnviar.set(false);
    this.enviados.set(0);
    this.errores.set([]);
    this.advertencias.set([]);
    void this.procesarLote(this.plantillas());
  }

  /** Reintenta únicamente las facturas con fallo transitorio (504 / red). */
  protected reintentarFallidas(): void {
    const fallidas = new Set(this.erroresReintentables().map((e) => e.secuencial));
    const pendientes = this.plantillas().filter((p) => fallidas.has(p.secuencial));
    this.errores.update((lista) => lista.filter((e) => !e.reintentable));
    void this.procesarLote(pendientes);
  }

  /**
   * Envío secuencial (no en paralelo): da progreso real por factura, permite
   * saber cuál falló y no satura el buzón de salida con envíos simultáneos.
   */
  private async procesarLote(lote: PlantillaCorreo[]): Promise<void> {
    if (!lote.length || this.enviando()) return;
    const miEpoch = this.epoch;
    this.enviando.set(true);
    this.completado.set(false);
    this.lote.set(lote);
    this.procesadosLote.set(0);
    this.indice.set(0);

    for (const [posicion, plantilla] of lote.entries()) {
      if (this.epoch !== miEpoch) return; // pantalla abandonada o periodo cambiado
      this.indice.set(posicion);
      this.enviandoSecuencial.set(plantilla.secuencial);
      try {
        const respuesta = await this.email.enviar({
          to: plantilla.to,
          cc: plantilla.cc.length ? plantilla.cc : undefined,
          subject: plantilla.subject,
          html: this.comoHtml(plantilla.bodyLines),
          text: plantilla.bodyLines.join('\n'),
          attachmentUrls: plantilla.adjuntos.length ? plantilla.adjuntos : undefined,
        });
        if (this.epoch !== miEpoch) return;
        // Un 200 con `rejected` significa que el correo SÍ salió hacia los
        // aceptados: se cuenta como enviado (reintentarlo duplicaría la
        // factura en el buzón) y se registra la advertencia.
        this.enviados.update((n) => n + 1);
        if (respuesta.rejected.length) {
          this.advertencias.update((lista) => [
            ...lista,
            { secuencial: plantilla.secuencial, detalle: `El servidor descartó destinatarios: ${respuesta.rejected.join(', ')}` },
          ]);
        }
      } catch (error) {
        if (this.epoch !== miEpoch) return;
        this.errores.update((lista) => [
          ...lista,
          { secuencial: plantilla.secuencial, motivo: mensajeDeError(error), reintentable: esReintentable(error) },
        ]);
      }
      this.procesadosLote.update((n) => n + 1);
    }

    if (this.epoch !== miEpoch) return;
    this.enviando.set(false);
    this.completado.set(true);
  }

  /** Convierte las líneas del cuerpo en párrafos HTML. */
  private comoHtml(lineas: readonly string[]): string {
    return lineas.map((linea) => `<p style="margin:0 0 8px">${escaparHtml(linea)}</p>`).join('');
  }

  private reiniciarEnvio(): void {
    this.epoch++; // invalida cualquier bucle de envío en curso
    this.confirmEnviar.set(false);
    this.enviando.set(false);
    this.completado.set(false);
    this.indice.set(0);
    this.enviados.set(0);
    this.errores.set([]);
    this.advertencias.set([]);
    this.enviandoSecuencial.set('');
    this.lote.set([]);
    this.procesadosLote.set(0);
  }
}
