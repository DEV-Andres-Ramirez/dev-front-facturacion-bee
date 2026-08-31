import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuditoriaService } from '@core/services/auditoria.service';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { DocumentoFacturacion, DocKind, TipoDocumento } from '@core/models';
import { docKindPresentation } from '@core/utils/doc-kind.util';
import { ArchivoDescargable, descargarZip } from '@core/utils/zip.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';

/** Un archivo del periodo, ya listo para pintar y descargar. */
interface ArchivoVista {
  readonly id: number;
  readonly nombre: string;
  readonly tipo: TipoDocumento;
  readonly kind: DocKind;
  readonly url: string;
  readonly extension: string;
}

/** Una categoría del árbol: el tipo de documento con sus archivos. */
interface Categoria {
  readonly tipo: TipoDocumento;
  readonly archivos: readonly ArchivoVista[];
  readonly abierta: boolean;
}

/** Orden en que se muestran las categorías: el del ciclo, no el alfabético. */
const ORDEN_TIPOS: readonly TipoDocumento[] = [
  'Aprobación Prefactura',
  'Registro Facturación Interna',
  'Novedades Periodo',
  'Pedido Compra',
  'Factura BEE',
  'Consolidado Facturacion BEE',
];

/** Deduce el tipo de archivo a partir de su extensión, para el icono. */
function kindDeExtension(extension: string): DocKind {
  if (['xlsx', 'xls', 'xlsm', 'csv'].includes(extension)) return 'xls';
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'img';
  return 'doc';
}

/** Conservación de registros: archivo documental del periodo (RF-DOC). */
@Component({
  selector: 'app-registros',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './registros.html',
  styleUrl: './registros.css',
})
export class Registros {
  private readonly documentos = inject(DocumentosService);
  private readonly auditoria = inject(AuditoriaService);
  protected readonly periodStore = inject(PeriodStore);

  protected readonly periodLabel = this.periodStore.label;
  protected readonly loading = this.documentos.loading;
  protected readonly docKind = docKindPresentation;

  protected readonly busqueda = signal('');
  protected readonly abiertas = signal<Record<string, boolean>>({});
  protected readonly descargando = signal(false);
  protected readonly aviso = signal('');

  constructor() {
    effect(() => {
      const label = this.periodStore.label();
      if (!label) return;
      this.busqueda.set('');
      this.aviso.set('');
      void this.documentos.loadPeriodo(label);
    });
  }

  // ── Datos ───────────────────────────────────────────────────────────────────

  private readonly archivos = computed<ArchivoVista[]>(() =>
    this.documentos.docs().map((doc) => this.aVista(doc)),
  );

  protected readonly hayArchivos = computed(() => this.archivos().length > 0);

  private readonly filtrados = computed<ArchivoVista[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) return this.archivos();
    return this.archivos().filter(
      (a) => a.nombre.toLowerCase().includes(texto) || a.tipo.toLowerCase().includes(texto),
    );
  });

  /** Árbol por categoría, en el orden del ciclo y sin categorías vacías. */
  protected readonly categorias = computed<Categoria[]>(() => {
    const porTipo = new Map<TipoDocumento, ArchivoVista[]>();
    for (const archivo of this.filtrados()) {
      const lista = porTipo.get(archivo.tipo) ?? [];
      lista.push(archivo);
      porTipo.set(archivo.tipo, lista);
    }

    const buscando = this.busqueda().trim().length > 0;
    return ORDEN_TIPOS.filter((tipo) => porTipo.has(tipo)).map((tipo) => ({
      tipo,
      archivos: (porTipo.get(tipo) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      // Al buscar se despliega todo: si no, habría que abrir cada carpeta para
      // ver dónde cayeron las coincidencias.
      abierta: buscando || this.abiertas()[tipo] === true,
    }));
  });

  protected readonly totalFiltrado = computed(() => this.filtrados().length);
  protected readonly resumen = computed(() => {
    const total = this.archivos().length;
    const categorias = new Set(this.archivos().map((a) => a.tipo)).size;
    return { total, categorias };
  });

  // ── Interacción ─────────────────────────────────────────────────────────────

  protected alternar(tipo: TipoDocumento): void {
    this.abiertas.update((estado) => ({ ...estado, [tipo]: !estado[tipo] }));
  }

  protected setBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  /** Cada descarga individual queda registrada en la bitácora (RF-DOC-02). */
  protected registrarDescarga(archivo: ArchivoVista): void {
    this.auditoria.registrar({
      modulo: 'Registros',
      accion: 'DESCARGAR_SOPORTE',
      observacion: `Descargó el soporte «${archivo.nombre}» del periodo ${this.periodLabel()}.`,
      entidad: 'documento',
      referencia: archivo.nombre,
      detalle: { tipo: archivo.tipo },
    });
  }

  protected async descargarPeriodo(): Promise<void> {
    if (this.descargando()) return;
    this.descargando.set(true);
    this.aviso.set('');

    const periodo = this.periodLabel();
    const paquete: ArchivoDescargable[] = this.archivos().map((a) => ({
      nombre: a.nombre,
      carpeta: a.tipo,
      url: a.url,
    }));

    const resultado = await descargarZip(
      `soportes-${periodo.toLowerCase().replace(/\s+/g, '-')}.zip`,
      paquete,
    );
    this.descargando.set(false);

    this.auditoria.registrar({
      modulo: 'Registros',
      accion: 'DESCARGAR_PERIODO',
      resultado: resultado.ok ? (resultado.fallidos.length ? 'advertencia' : 'exito') : 'error',
      observacion: resultado.ok
        ? `Descargó ${resultado.incluidos} soporte(s) del periodo ${periodo} en un archivo comprimido.`
        : `No se pudo generar el archivo comprimido del periodo ${periodo}.`,
      entidad: 'periodo',
      referencia: periodo,
      detalle: { incluidos: resultado.incluidos, fallidos: resultado.fallidos.length },
    });

    if (!resultado.ok) {
      this.aviso.set('No se pudo descargar ningún archivo. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    if (resultado.fallidos.length) {
      this.aviso.set(
        `Se descargaron ${resultado.incluidos} archivo(s). No se pudieron incluir: ${resultado.fallidos.join(', ')}.`,
      );
    }
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private aVista(doc: DocumentoFacturacion): ArchivoVista {
    const desdeUrl = decodeURIComponent(doc.direccion_documento_facturacion.split('/').pop() ?? '');
    // El nombre en Storage lleva una marca de tiempo delante para evitar
    // colisiones; para mostrarlo se quita.
    const limpio = desdeUrl.replace(/^\d+-/, '');
    const extension = (limpio.split('.').pop() ?? '').toLowerCase();
    const nombre = doc.nombre_documento_facturacion
      ? `${doc.nombre_documento_facturacion}.${extension}`
      : limpio;

    return {
      id: doc.id_documento_facturacion,
      nombre,
      tipo: doc.tipo_documento_facturacion,
      kind: kindDeExtension(extension),
      url: doc.direccion_documento_facturacion,
      extension,
    };
  }
}
