import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AuditoriaService,
  EVENTOS_POR_PAGINA,
  FILTRO_VACIO,
} from '@core/services/auditoria.service';
import {
  AuditoriaRow,
  ETIQUETA_RESULTADO,
  FiltroAuditoria,
  ResultadoAuditoria,
  TONO_RESULTADO,
} from '@core/models';
import { formatFechaHora, limiteDelDia } from '@core/utils/fecha.util';
import { initialsOf } from '@core/utils/usuario.mapper';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';

/** Auditoría y logs: bitácora inmutable de acciones del sistema (RF-LOG). */
@Component({
  selector: 'app-auditoria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.css',
})
export class Auditoria implements OnInit {
  private readonly auditoria = inject(AuditoriaService);

  protected readonly eventos = this.auditoria.rows;
  protected readonly resumen = this.auditoria.resumen;
  protected readonly loading = this.auditoria.loading;
  protected readonly loadError = this.auditoria.error;
  protected readonly total = this.auditoria.total;
  protected readonly paginas = this.auditoria.paginas;
  protected readonly usuariosDisponibles = this.auditoria.usuariosDisponibles;
  protected readonly modulosDisponibles = this.auditoria.modulosDisponibles;
  protected readonly accionesDisponibles = this.auditoria.accionesDisponibles;

  /** Fechas tal como las escribe el usuario; se convierten al consultar. */
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly filtro = signal<FiltroAuditoria>(FILTRO_VACIO);
  protected readonly detalle = signal<AuditoriaRow | null>(null);
  protected readonly avisoExportacion = signal('');

  protected readonly formatFechaHora = formatFechaHora;
  protected readonly initialsOf = initialsOf;

  protected readonly hayFiltroActivo = computed(() => {
    const f = this.filtro();
    return Boolean(
      f.desde || f.hasta || f.correo || f.modulo || f.accion || f.resultado || f.busqueda,
    );
  });

  /** «Mostrando 51–100 de 248» — el rango real, no un número fijo. */
  protected readonly rangoVisible = computed(() => {
    const total = this.total();
    if (total === 0) return { desde: 0, hasta: 0, total: 0 };
    const inicio = this.filtro().pagina * EVENTOS_POR_PAGINA;
    return { desde: inicio + 1, hasta: inicio + this.eventos().length, total };
  });

  ngOnInit(): void {
    void this.auditoria.cargarOpciones();
    void this.auditoria.load(this.filtro());
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────

  protected setDesde(event: Event): void {
    this.desde.set((event.target as HTMLInputElement).value);
    this.aplicar({ desde: limiteDelDia(this.desde(), 'inicio') });
  }

  protected setHasta(event: Event): void {
    this.hasta.set((event.target as HTMLInputElement).value);
    this.aplicar({ hasta: limiteDelDia(this.hasta(), 'fin') });
  }

  protected setCorreo(event: Event): void {
    this.aplicar({ correo: this.valorSeleccionado(event) });
  }

  protected setModulo(event: Event): void {
    this.aplicar({ modulo: this.valorSeleccionado(event) });
  }

  protected setAccion(event: Event): void {
    this.aplicar({ accion: this.valorSeleccionado(event) });
  }

  protected setResultado(event: Event): void {
    this.aplicar({ resultado: this.valorSeleccionado(event) });
  }

  protected setBusqueda(event: Event): void {
    this.aplicar({ busqueda: (event.target as HTMLInputElement).value });
  }

  protected limpiarFiltros(): void {
    this.desde.set('');
    this.hasta.set('');
    this.filtro.set(FILTRO_VACIO);
    void this.auditoria.load(FILTRO_VACIO);
  }

  // ── Paginación ──────────────────────────────────────────────────────────────

  protected paginaAnterior(): void {
    const actual = this.filtro().pagina;
    if (actual > 0) this.irAPagina(actual - 1);
  }

  protected paginaSiguiente(): void {
    const actual = this.filtro().pagina;
    if (actual + 1 < this.paginas()) this.irAPagina(actual + 1);
  }

  // ── Detalle y exportación ───────────────────────────────────────────────────

  protected verDetalle(evento: AuditoriaRow): void {
    this.detalle.set(evento);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  /** El `detalle_auditoria` es JSON libre: se pinta como pares legibles. */
  protected paresDeDetalle(evento: AuditoriaRow): { clave: string; valor: string }[] {
    const detalle = evento.detalle_auditoria;
    if (!detalle) return [];
    return Object.entries(detalle).map(([clave, valor]) => ({
      clave,
      valor: typeof valor === 'object' ? JSON.stringify(valor) : String(valor),
    }));
  }

  protected async exportar(): Promise<void> {
    this.avisoExportacion.set(await this.auditoria.exportarCsv(this.filtro()));
  }

  // ── Presentación ────────────────────────────────────────────────────────────

  protected tono(resultado: ResultadoAuditoria) {
    return TONO_RESULTADO[resultado] ?? 'neutral';
  }

  protected etiquetaResultado(resultado: ResultadoAuditoria): string {
    return ETIQUETA_RESULTADO[resultado] ?? resultado;
  }

  /** La acción se guarda en mayúsculas con guiones bajos; se muestra legible. */
  protected accionLegible(accion: string): string {
    const texto = accion.replace(/_/g, ' ').toLowerCase();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  /** Un `<select>` devuelve cadena vacía para «todos»; la BD espera `null`. */
  private valorSeleccionado(event: Event): string | null {
    return (event.target as HTMLSelectElement).value || null;
  }

  /** Cualquier cambio de filtro vuelve a la primera página. */
  private aplicar(cambio: Partial<FiltroAuditoria>): void {
    const siguiente = { ...this.filtro(), ...cambio, pagina: 0 };
    this.filtro.set(siguiente);
    this.avisoExportacion.set('');
    void this.auditoria.load(siguiente);
  }

  private irAPagina(pagina: number): void {
    const siguiente = { ...this.filtro(), pagina };
    this.filtro.set(siguiente);
    void this.auditoria.load(siguiente);
  }
}
