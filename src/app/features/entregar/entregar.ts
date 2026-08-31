import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DocumentosService } from '@core/services/documentos.service';
import { AuditoriaService } from '@core/services/auditoria.service';
import { EmailService, esReintentable, mensajeDeError } from '@core/services/email.service';
import { PeriodStore } from '@core/services/period.store';
import { FacturasService } from '@core/services/facturas.service';
import { ParametrosService } from '@core/services/parametros.service';
import {
  CampoCorreo,
  CorreoPreparado,
  DiagnosticoCorreo,
  EdicionCorreo,
  EstadoEnvio,
  EstadoServicio,
  PRESENTACION_ENVIO,
  SemanticTone,
} from '@core/models';
import { componerCorreos, cuerpoComoHtml, prepararCorreo } from '@core/utils/correo.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';

/** Cómo terminó el envío de una factura concreta. */
interface EstadoFactura {
  readonly estado: EstadoEnvio;
  readonly motivo?: string;
  readonly reintentable?: boolean;
}

/** Correos entregados con destinatarios descartados por el servidor. */
interface AdvertenciaEnvio {
  readonly secuencial: string;
  readonly detalle: string;
}

/** Prefijo de la clave con la que se recuerdan las ediciones de cada periodo. */
const CLAVE_EDICIONES = 'bee.correos.';

/**
 * Recupera las ediciones guardadas. Un almacenamiento bloqueado (modo privado)
 * o un JSON corrupto devuelven «sin ediciones» en vez de tumbar la pantalla.
 */
function leerEdiciones(clave: string): Record<string, EdicionCorreo> {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return {};
    const datos: unknown = JSON.parse(crudo);
    return typeof datos === 'object' && datos !== null
      ? (datos as Record<string, EdicionCorreo>)
      : {};
  } catch {
    return {};
  }
}

function guardarEdiciones(
  clave: string,
  ediciones: Record<string, EdicionCorreo>,
): void {
  try {
    if (Object.keys(ediciones).length === 0) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(ediciones));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: la edición sigue viva en
    // memoria durante la sesión, que es lo que hace falta para poder enviar.
  }
}

@Component({
  selector: 'app-entregar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './entregar.html',
  styleUrl: './entregar.css',
})
export class Entregar {
  private readonly periodStore = inject(PeriodStore);
  private readonly documentos = inject(DocumentosService);
  private readonly auditoria = inject(AuditoriaService);
  private readonly facturas = inject(FacturasService);
  private readonly parametros = inject(ParametrosService);
  private readonly email = inject(EmailService);

  protected readonly periodLabel = computed(() => this.periodStore.label());
  protected readonly cliente = computed(() => this.parametros.texto('correo_cliente'));

  private readonly registro = this.documentos.registro;

  protected readonly hayDatos = computed(() => this.registro().length > 0);
  protected readonly revisado = computed(() => this.periodStore.alcanzo('entrega'));

  /** Los correos que genera el sistema a partir de los datos del periodo. */
  private readonly plantillas = computed(() =>
    componerCorreos({
      periodo: this.periodStore.label(),
      registro: this.registro(),
      prefactura: this.documentos.prefactura(),
      facturas: this.facturas.porSecuencial(),
      destinatario: this.parametros.texto('correo_cliente'),
      copiasFijas: this.parametros.lista('correo_copias'),
      proveedor: this.parametros.texto('proveedor_nombre'),
      asunto: this.parametros.texto('asunto_entrega'),
    }),
  );

  // ── Edición ──────────────────────────────────────────────────────────────────

  /**
   * Sobrescrituras del usuario encima de la plantilla generada. Es el mismo
   * patrón que usa «Revisar»: lo que no se toca sigue derivándose de los datos,
   * así que un cambio en la fuente se refleja solo en los campos intactos.
   */
  private readonly ediciones = signal<Record<string, EdicionCorreo>>({});

  protected readonly hayEdiciones = computed(
    () => Object.keys(this.ediciones()).length > 0,
  );

  /** Los correos tal y como saldrían, con sus ediciones y sus avisos. */
  protected readonly correos = computed<CorreoPreparado[]>(() => {
    const ediciones = this.ediciones();
    return this.plantillas().map((plantilla) =>
      prepararCorreo(plantilla, ediciones[plantilla.secuencial]),
    );
  });

  private clave(): string {
    return `${CLAVE_EDICIONES}${this.periodStore.period()}`;
  }

  private aplicar(secuencial: string, campo: CampoCorreo, valor: string): void {
    this.ediciones.update((actual) => {
      const siguiente = {
        ...actual,
        [secuencial]: { ...actual[secuencial], [campo]: valor },
      };
      guardarEdiciones(this.clave(), siguiente);
      return siguiente;
    });
  }

  protected editar(secuencial: string, campo: CampoCorreo, evento: Event): void {
    const destino = evento.target as HTMLInputElement | HTMLTextAreaElement;
    this.aplicar(secuencial, campo, destino.value);
  }

  /**
   * Campos ya auditados en esta visita, para no registrar un evento por cada
   * pulsación de tecla: interesa que se editó el asunto, no cuántas veces.
   */
  private readonly auditados = new Set<string>();

  private static readonly NOMBRE_CAMPO: Record<CampoCorreo, string> = {
    to: 'los destinatarios',
    cc: 'las copias',
    subject: 'el asunto',
    cuerpo: 'el cuerpo',
  };

  /** Al salir del campo se deja constancia de que el correo se modificó. */
  protected auditarEdicion(secuencial: string, campo: CampoCorreo): void {
    const correo = this.correos().find((c) => c.secuencial === secuencial);
    const plantilla = this.plantillas().find((p) => p.secuencial === secuencial);
    if (!correo || !plantilla) return;

    const clave = `${secuencial}|${campo}`;
    if (this.auditados.has(clave) || correo[campo] === plantilla[campo]) return;
    this.auditados.add(clave);

    this.auditoria.registrar({
      modulo: 'Entrega',
      accion: 'EDITAR_CORREO',
      resultado: 'exito',
      observacion: `Modificó ${Entregar.NOMBRE_CAMPO[campo]} del correo de la factura ${secuencial}.`,
      entidad: 'factura',
      referencia: secuencial,
      detalle: { campo },
    });
  }

  protected restablecer(secuencial: string): void {
    this.ediciones.update((actual) => {
      const siguiente = { ...actual };
      delete siguiente[secuencial];
      guardarEdiciones(this.clave(), siguiente);
      return siguiente;
    });
  }

  protected restablecerTodos(): void {
    this.ediciones.set({});
    guardarEdiciones(this.clave(), {});
  }

  // ── Selección ────────────────────────────────────────────────────────────────

  /**
   * `null` significa «el usuario aún no ha elegido»: entonces se proponen todas
   * las que quedan por entregar. Así la propuesta se recalcula sola mientras
   * cargan los datos, sin necesidad de un efecto que escriba señales.
   */
  private readonly seleccionManual = signal<ReadonlySet<string> | null>(null);

  private pendientes(): string[] {
    return this.correos()
      .filter((correo) => !correo.yaEnviada)
      .map((correo) => correo.secuencial);
  }

  protected readonly seleccionados = computed<ReadonlySet<string>>(
    () => this.seleccionManual() ?? new Set(this.pendientes()),
  );

  protected readonly numSeleccionados = computed(() => this.seleccionados().size);

  protected readonly numPendientes = computed(() => this.pendientes().length);

  /** Reenvíos marcados: el cliente recibiría la misma factura por segunda vez. */
  protected readonly numReenvios = computed(() => {
    const marcados = this.seleccionados();
    return this.correos().filter(
      (correo) => correo.yaEnviada && marcados.has(correo.secuencial),
    ).length;
  });

  protected readonly numSinEnviar = computed(
    () => this.correos().length - this.numSeleccionados(),
  );

  protected marcada(secuencial: string): boolean {
    return this.seleccionados().has(secuencial);
  }

  protected alternar(secuencial: string): void {
    const siguiente = new Set(this.seleccionados());
    if (!siguiente.delete(secuencial)) siguiente.add(secuencial);
    this.seleccionManual.set(siguiente);
    this.errorAccion.set('');
  }

  /** Marca lo que queda por entregar; las ya enviadas se dejan fuera aposta. */
  protected marcarPendientes(): void {
    this.seleccionManual.set(new Set(this.pendientes()));
    this.errorAccion.set('');
  }

  protected desmarcarTodas(): void {
    this.seleccionManual.set(new Set());
  }

  // ── Estado del servicio de correo ────────────────────────────────────────────

  protected readonly estadoServicio = signal<EstadoServicio>('sin_comprobar');
  protected readonly diagnostico = signal<DiagnosticoCorreo | null>(null);
  protected readonly motivoSinDiagnostico = signal('');
  protected readonly verDiagnostico = signal(false);

  protected abrirDiagnostico(): void {
    this.verDiagnostico.set(true);
  }

  protected cerrarDiagnostico(): void {
    this.verDiagnostico.set(false);
  }

  /** Comprobación pedida por el usuario: sí deja rastro en la bitácora. */
  protected recomprobar(): void {
    void this.comprobarServicio(true);
  }

  /**
   * Pregunta al backend si su buzón puede enviar. Devuelve el estado resultante
   * para que quien la llame decida; nunca lanza.
   *
   * `auditar` distingue la comprobación automática al abrir la pantalla de la
   * que nace de un acto del usuario. Registrar la primera crearía una fila cada
   * vez que alguien entra en Entregar —y con el buzón caído, siempre—, que es
   * justo el ruido que la regla 3 de la bitácora prohíbe.
   */
  private async comprobarServicio(auditar: boolean): Promise<EstadoServicio> {
    const miEpoch = this.epoch;
    this.estadoServicio.set('comprobando');

    const resultado = await this.email.verificarServicio();
    if (this.epoch !== miEpoch) return this.estadoServicio();

    if (resultado.estado === 'indeterminado') {
      this.diagnostico.set(null);
      this.motivoSinDiagnostico.set(resultado.motivo);
      // No se pudo preguntar: se avisa, pero no se bloquea el envío. Impedirlo
      // por una causa sin confirmar sería peor que dejarlo fallar con detalle.
      if (auditar) {
        this.auditoria.registrar({
          modulo: 'Entrega',
          accion: 'VERIFICAR_CORREO',
          resultado: 'advertencia',
          observacion: `No se pudo comprobar el servicio de correo: ${resultado.motivo}`,
        });
      }
    } else {
      const { diagnostico } = resultado;
      this.diagnostico.set(diagnostico);
      this.motivoSinDiagnostico.set('');
      // Solo se audita lo que merece atención: registrar cada comprobación
      // correcta llenaría la bitácora de ruido sin aportar nada.
      if (auditar && !diagnostico.operativo) {
        this.auditoria.registrar({
          modulo: 'Entrega',
          accion: 'VERIFICAR_CORREO',
          resultado: 'error',
          observacion: `El buzón ${diagnostico.remitente} no puede enviar correos: ${diagnostico.titulo}`,
          detalle: {
            codigo: diagnostico.codigo,
            remitente: diagnostico.remitente,
            servidor: diagnostico.servidor,
          },
        });
      }
    }

    this.estadoServicio.set(resultado.estado);
    return resultado.estado;
  }

  // ── Envío ────────────────────────────────────────────────────────────────────

  protected readonly confirmEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly completado = signal(false);
  protected readonly errorAccion = signal('');
  protected readonly enviandoSecuencial = signal('');
  protected readonly advertencias = signal<AdvertenciaEnvio[]>([]);

  /** Estado de cada factura en el último envío. */
  private readonly estados = signal<Record<string, EstadoFactura>>({});

  private readonly lote = signal<CorreoPreparado[]>([]);
  private readonly procesados = signal(0);

  protected readonly loteTotal = computed(() => this.lote().length);
  protected readonly progreso = computed(() =>
    Math.round((this.procesados() / (this.lote().length || 1)) * 100),
  );

  /**
   * Época del envío: se incrementa al cambiar de periodo, al cancelar y al
   * destruir el componente, y el bucle en curso la comprueba tras cada `await`
   * para detenerse en lugar de seguir enviando correos huérfanos.
   */
  private epoch = 0;

  constructor() {
    effect(() => {
      this.periodStore.period();
      const label = this.periodStore.label();
      if (!label) return; // el catálogo de periodos aún no ha cargado
      this.reiniciar();
      void this.documentos.loadPeriodo(label);
      void this.facturas.load(label);
      // Se comprueba al abrir para que el problema se vea antes de preparar
      // nada, no después de haber revisado veinte correos. Sin auditar: abrir
      // una pantalla no es un acto que merezca una fila en la bitácora.
      void this.comprobarServicio(false);
    });
    // Detiene el bucle de envío si el usuario abandona la pantalla.
    inject(DestroyRef).onDestroy(() => this.epoch++);
  }

  protected estadoDe(secuencial: string): EstadoEnvio {
    return this.estados()[secuencial]?.estado ?? 'pendiente';
  }

  protected motivoDe(secuencial: string): string {
    return this.estados()[secuencial]?.motivo ?? '';
  }

  protected etiquetaEstado(estado: EstadoEnvio): string {
    return PRESENTACION_ENVIO[estado].etiqueta;
  }

  protected tonoEstado(estado: EstadoEnvio): SemanticTone {
    return PRESENTACION_ENVIO[estado].tono;
  }

  /** Resultado del último envío, en los tres grupos que le importan al usuario. */
  protected readonly resumen = computed(() => {
    const estados = this.estados();
    const correos = this.correos();
    const con = (estado: EstadoEnvio): CorreoPreparado[] =>
      correos.filter((correo) => estados[correo.secuencial]?.estado === estado);

    return {
      enviados: con('enviado'),
      conError: con('error'),
      sinEnviar: con('omitido'),
    };
  });

  protected readonly hayResultado = computed(
    () => this.completado() && Object.keys(this.estados()).length > 0,
  );

  protected readonly reintentables = computed(() =>
    this.resumen().conError.filter(
      (correo) => this.estados()[correo.secuencial]?.reintentable,
    ),
  );

  /** Comprueba el servicio y, si se puede enviar, pide confirmación. */
  protected async enviar(): Promise<void> {
    if (this.enviando()) return;
    this.errorAccion.set('');

    const elegidos = this.correos().filter((correo) =>
      this.seleccionados().has(correo.secuencial),
    );

    if (elegidos.length === 0) {
      this.errorAccion.set('Marca al menos una factura para poder enviar.');
      return;
    }

    const conProblemas = elegidos.filter((correo) => !correo.listo);
    if (conProblemas.length > 0) {
      this.errorAccion.set(
        `Revisa los datos de: ${conProblemas.map((c) => c.secuencial).join(', ')}. ` +
          'Cada correo necesita al menos un destinatario válido y un asunto.',
      );
      return;
    }

    // Se vuelve a comprobar aunque ya se hiciera al abrir la pantalla: entre
    // una cosa y otra el buzón puede haberse caído, y es peor descubrirlo
    // factura a factura que antes de empezar.
    const estado = await this.comprobarServicio(true);
    if (estado === 'caido') {
      this.verDiagnostico.set(true);
      return;
    }

    this.confirmEnviar.set(true);
  }

  protected cancelarEnviar(): void {
    this.confirmEnviar.set(false);
  }

  protected confirmarEnviar(): void {
    this.confirmEnviar.set(false);
    this.advertencias.set([]);
    void this.procesarLote(
      this.correos().filter((correo) => this.seleccionados().has(correo.secuencial)),
    );
  }

  /** Reintenta únicamente las facturas con fallo transitorio (504 / red). */
  protected reintentarFallidas(): void {
    void this.procesarLote(this.reintentables());
  }

  /**
   * Detiene el lote. Un correo que ya salió hacia el servidor no se puede
   * retirar, así que el que esté en curso se completa; los siguientes no salen.
   */
  protected cancelarEnvio(): void {
    if (!this.enviando()) return;
    this.epoch++;
    this.enviando.set(false);
    this.completado.set(true);
    this.enviandoSecuencial.set('');
    this.estados.update((actual) => {
      const siguiente = { ...actual };
      for (const [secuencial, estado] of Object.entries(actual)) {
        if (estado.estado === 'pendiente' || estado.estado === 'enviando') {
          siguiente[secuencial] = { estado: 'omitido' };
        }
      }
      return siguiente;
    });
  }

  /**
   * Envío secuencial (no en paralelo): da progreso real por factura, permite
   * saber cuál falló y no satura el buzón de salida con envíos simultáneos.
   */
  private async procesarLote(lote: CorreoPreparado[]): Promise<void> {
    if (lote.length === 0 || this.enviando()) return;

    const miEpoch = this.epoch;
    this.prepararEstados(lote);
    this.enviando.set(true);
    this.completado.set(false);
    this.lote.set(lote);
    this.procesados.set(0);

    for (const correo of lote) {
      if (this.epoch !== miEpoch) return; // pantalla abandonada o envío cancelado
      this.enviandoSecuencial.set(correo.secuencial);
      this.fijarEstado(correo.secuencial, { estado: 'enviando' });

      try {
        const respuesta = await this.email.enviar({
          to: correo.destinatarios,
          cc: correo.copias.length ? correo.copias : undefined,
          subject: correo.subject,
          html: cuerpoComoHtml(correo.cuerpo),
          text: correo.cuerpo,
          attachmentUrls: correo.adjuntos.length ? correo.adjuntos : undefined,
        });
        if (this.epoch !== miEpoch) return;

        // Un 200 con `rejected` significa que el correo SÍ salió hacia los
        // aceptados: se cuenta como enviado (reintentarlo duplicaría la factura
        // en el buzón del cliente) y se registra la advertencia.
        this.fijarEstado(correo.secuencial, { estado: 'enviado' });

        // La factura pasa a «enviada» con su fecha: es lo que después alimenta
        // el cálculo de días para el pago en Conciliar.
        void this.facturas.marcarEnviada(this.periodStore.label(), correo.secuencial);

        if (respuesta.rejected.length) {
          this.advertencias.update((lista) => [
            ...lista,
            {
              secuencial: correo.secuencial,
              detalle: `El servidor descartó destinatarios: ${respuesta.rejected.join(', ')}`,
            },
          ]);
        }

        // `registrar` no se espera nunca: un await aquí obligaría a volver a
        // comprobar la época y podría dejar correos huérfanos de un lote
        // abandonado. Ver la nota de arriba sobre `miEpoch`.
        this.auditoria.registrar({
          modulo: 'Entrega',
          accion: 'ENVIAR_FACTURA',
          resultado: respuesta.rejected.length ? 'advertencia' : 'exito',
          observacion: respuesta.rejected.length
            ? `Envió la factura ${correo.secuencial}, pero el servidor descartó ${respuesta.rejected.length} destinatario(s).`
            : `Envió la factura ${correo.secuencial} al cliente.`,
          entidad: 'factura',
          referencia: correo.secuencial,
          detalle: {
            destinatarios: correo.destinatarios.length,
            copias: correo.copias.length,
            adjuntos: respuesta.attachments,
            editado: correo.editado,
            reenvio: correo.yaEnviada,
            rechazados: respuesta.rejected,
            messageId: respuesta.messageId,
            duracionMs: respuesta.durationMs,
          },
        });
      } catch (error) {
        if (this.epoch !== miEpoch) return;
        const motivo = mensajeDeError(error);
        const reintentable = esReintentable(error);
        this.fijarEstado(correo.secuencial, { estado: 'error', motivo, reintentable });

        this.auditoria.registrar({
          modulo: 'Entrega',
          accion: 'ENVIAR_FACTURA',
          resultado: 'error',
          observacion: `No se pudo enviar la factura ${correo.secuencial}: ${motivo}`,
          entidad: 'factura',
          referencia: correo.secuencial,
          detalle: { destinatarios: correo.destinatarios.length, motivo, reintentable },
        });
      }

      this.procesados.update((n) => n + 1);
    }

    if (this.epoch !== miEpoch) return;
    this.enviando.set(false);
    this.completado.set(true);
    this.enviandoSecuencial.set('');
    // Refresca el estado real de las facturas para que «Ya enviada» refleje lo
    // que quedó guardado, y no lo que este componente cree recordar.
    void this.facturas.load(this.periodStore.label());
  }

  /**
   * Deja constancia de las que no entran en el lote.
   *
   * Es la tercera respuesta que el usuario necesita —cuáles salieron, cuáles
   * fallaron y cuáles ni se intentaron—, y sin marcarlas quedarían indistinguibles
   * de las que aún no se han tocado.
   */
  private prepararEstados(lote: readonly CorreoPreparado[]): void {
    const enLote = new Set(lote.map((correo) => correo.secuencial));
    this.estados.update((actual) => {
      const siguiente: Record<string, EstadoFactura> = {};
      for (const correo of this.correos()) {
        const previo = actual[correo.secuencial];
        siguiente[correo.secuencial] = enLote.has(correo.secuencial)
          ? { estado: 'pendiente' }
          : // Un resultado anterior se conserva: reintentar dos facturas no
            // borra lo que se sabe de las otras dieciocho.
            (previo ?? { estado: 'omitido' });
      }
      return siguiente;
    });
  }

  private fijarEstado(secuencial: string, estado: EstadoFactura): void {
    this.estados.update((actual) => ({ ...actual, [secuencial]: estado }));
  }

  private reiniciar(): void {
    this.epoch++; // invalida cualquier bucle de envío en curso
    this.confirmEnviar.set(false);
    this.verDiagnostico.set(false);
    this.enviando.set(false);
    this.completado.set(false);
    this.errorAccion.set('');
    this.enviandoSecuencial.set('');
    this.advertencias.set([]);
    this.estados.set({});
    this.lote.set([]);
    this.procesados.set(0);
    this.seleccionManual.set(null);
    this.auditados.clear();
    this.ediciones.set(leerEdiciones(this.clave()));
  }
}
