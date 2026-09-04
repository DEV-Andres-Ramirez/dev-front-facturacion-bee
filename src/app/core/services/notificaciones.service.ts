import { Injectable, computed, inject } from '@angular/core';
import { Notificacion } from '../models';
import { DocumentosService } from './documentos.service';
import { FacturasService } from './facturas.service';
import { PeriodStore } from './period.store';
import { PeriodosService } from './periodos.service';

/** Día del mes a partir del cual se recuerda crear el periodo siguiente. */
const DIA_AVISO_PERIODO = 25;

/**
 * Centro de notificaciones.
 *
 * No hay tabla detrás y es deliberado: cada aviso se **deriva del estado real**
 * en el momento de mirarlo. Así no puede quedarse obsoleto —desaparece solo en
 * cuanto se resuelve lo que lo originó— y no hay ciclo de vida que mantener ni
 * marcas de «leído» que se desincronicen de la realidad.
 *
 * Cada notificación enlaza al módulo que la resuelve, como pide RF-DSH-03.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly periodos = inject(PeriodosService);
  private readonly periodStore = inject(PeriodStore);
  private readonly facturas = inject(FacturasService);
  private readonly documentos = inject(DocumentosService);

  readonly notificaciones = computed<Notificacion[]>(() => {
    const avisos: Notificacion[] = [
      ...this.avisoPeriodoSiguiente(),
      ...this.avisosDeFacturas(),
      ...this.avisosDeDocumentos(),
    ];
    return avisos.sort((a, b) => a.prioridad - b.prioridad);
  });

  readonly total = computed(() => this.notificaciones().length);
  readonly hayUrgentes = computed(() =>
    this.notificaciones().some((n) => n.tono === 'bad' || n.tono === 'warn'),
  );

  /**
   * A partir del día 25 recuerda crear el periodo del mes siguiente, y deja de
   * avisar en cuanto existe. La fecha se lee en cada evaluación, así que el
   * aviso aparece solo al llegar el día sin necesidad de recargar nada.
   */
  private avisoPeriodoSiguiente(): Notificacion[] {
    const hoy = new Date();
    if (hoy.getDate() < DIA_AVISO_PERIODO) return [];

    const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const anio = siguiente.getFullYear();
    const mes = siguiente.getMonth() + 1;
    if (this.periodos.existe(anio, mes)) return [];

    const etiqueta = this.periodos.etiqueta(anio, mes);
    return [
      {
        id: `periodo-${anio}-${mes}`,
        tono: 'warn',
        icono: 'plus',
        titulo: `Crea el periodo de ${etiqueta}`,
        detalle: `Estamos a ${hoy.getDate()} y el periodo todavía no existe. Créalo para poder cargar sus documentos.`,
        ruta: null,
        accion: 'Crear periodo',
        prioridad: 0,
      },
    ];
  }

  private avisosDeFacturas(): Notificacion[] {
    const avisos: Notificacion[] = [];
    const vigentes = this.facturas.vigentes();
    if (vigentes.length === 0) return avisos;

    const vencidas = this.facturas.vencidas();
    if (vencidas.length > 0) {
      avisos.push({
        id: 'facturas-vencidas',
        tono: 'bad',
        icono: 'clock',
        titulo: `${vencidas.length} factura(s) vencida(s) sin pago`,
        detalle: `Superaron el plazo acordado desde su envío: ${vencidas
          .map((f) => f.secuencial_factura)
          .join(', ')}.`,
        ruta: ['/app', 'conciliar'],
        accion: 'Ir a Conciliar',
        prioridad: 1,
      });
    }

    const sinPedido = vigentes.filter((f) => !f.pedido_compra_factura);
    if (sinPedido.length > 0) {
      avisos.push({
        id: 'facturas-sin-pedido',
        tono: 'info',
        icono: 'file',
        titulo: `${sinPedido.length} factura(s) sin pedido de compra`,
        detalle: 'Se enviarán al cliente sin ese soporte adjunto.',
        ruta: ['/app', 'revisar'],
        accion: 'Ir a Revisar',
        prioridad: 4,
      });
    }

    const porCobrar = this.facturas.enviadas().filter((f) => !f.vencida);
    if (porCobrar.length > 0) {
      avisos.push({
        id: 'facturas-por-cobrar',
        tono: 'info',
        icono: 'coins',
        titulo: `${porCobrar.length} factura(s) enviada(s) pendiente(s) de pago`,
        detalle: 'Aún dentro del plazo. Registra el pago cuando el banco lo notifique.',
        ruta: ['/app', 'conciliar'],
        accion: 'Ir a Conciliar',
        prioridad: 5,
      });
    }

    const porEnviar = this.facturas.porEnviar();
    if (porEnviar.length > 0 && this.periodStore.alcanzo('entrega')) {
      avisos.push({
        id: 'facturas-por-enviar',
        tono: 'warn',
        icono: 'send',
        titulo: `${porEnviar.length} factura(s) por entregar al cliente`,
        detalle: 'El periodo ya está en la etapa de entrega.',
        ruta: ['/app', 'entregar'],
        accion: 'Ir a Entregar',
        prioridad: 2,
      });
    }

    return avisos;
  }

  private avisosDeDocumentos(): Notificacion[] {
    if (!this.periodStore.listo()) return [];

    const registro = this.documentos.registro();
    if (registro.length === 0) return [];

    const sinFactura = this.facturas.vigentes().filter((f) => f.monto_emitido_factura === null);
    if (sinFactura.length === 0) return [];

    return [
      {
        id: 'facturas-sin-emitir',
        tono: 'warn',
        icono: 'alert',
        titulo: `${sinFactura.length} factura(s) sin datos de emisión`,
        detalle: 'Falta registrar el monto emitido o el PDF de la Factura BEE.',
        ruta: ['/app', 'revisar'],
        accion: 'Ir a Revisar',
        prioridad: 3,
      },
    ];
  }
}
