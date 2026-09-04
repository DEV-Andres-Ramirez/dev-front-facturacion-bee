import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon';

/** Una entrada del índice: el `id` de la sección y cómo se llama. */
export interface SeccionManual {
  readonly id: string;
  readonly label: string;
  /** Palabras que también deben encontrar esta sección al buscar. */
  readonly claves?: string;
}

/**
 * Índice de un manual, con buscador y seguimiento del apartado activo.
 *
 * Antes el índice era una lista de enlaces sin más: ni marcaba dónde estabas ni
 * permitía encontrar nada en un documento de doce apartados. En móvil ocupaba
 * una pantalla entera antes de llegar al contenido.
 */
@Component({
  selector: 'bee-toc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <nav class="toc" [class.abierto]="abierto()" aria-label="Índice del manual">
      <!-- En móvil el índice se pliega: doce apartados por delante del texto
           obligaban a desplazar una pantalla entera para empezar a leer. -->
      <button
        class="toc-movil"
        type="button"
        [attr.aria-expanded]="abierto()"
        (click)="abierto.set(!abierto())"
      >
        <bee-icon name="book" [size]="16" />
        <span>{{ tituloActual() }}</span>
        <span class="spacer"></span>
        <bee-icon name="chevron-down" [size]="16" class="toc-fx" />
      </button>

      <div class="toc-cuerpo">
        <p class="toc-title">{{ titulo() }}</p>

        <label class="sr-only" [attr.for]="idBusqueda">Buscar en el manual</label>
        <div class="toc-buscar">
          <bee-icon name="search" [size]="14" />
          <input
            [id]="idBusqueda"
            type="search"
            placeholder="Buscar apartado…"
            [value]="consulta()"
            (input)="buscar($event)"
          />
        </div>

        <div class="toc-lista">
          @for (seccion of visibles(); track seccion.id) {
            <a
              [href]="'#' + seccion.id"
              [class.activo]="seccion.id === activa()"
              (click)="ir($event, seccion.id)"
            >
              {{ seccion.label }}
            </a>
          } @empty {
            <p class="toc-vacio">Ningún apartado coincide.</p>
          }
        </div>
      </div>
    </nav>
  `,
  styleUrl: './toc.css',
})
export class TocComponent {
  readonly secciones = input.required<readonly SeccionManual[]>();
  readonly titulo = input('Contenido');

  protected readonly idBusqueda = `toc-q-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly consulta = signal('');
  protected readonly activa = signal('');
  protected readonly abierto = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /* `inject()` solo funciona en el contexto de construcción, y `observar()`
     corre después del primer render: hay que quedárselo antes. */
  private readonly destruccion = inject(DestroyRef);

  protected readonly visibles = computed(() => {
    const q = this.consulta().trim().toLowerCase();
    if (!q) return this.secciones();
    return this.secciones().filter((seccion) =>
      `${seccion.label} ${seccion.claves ?? ''}`.toLowerCase().includes(q),
    );
  });

  protected readonly tituloActual = computed(() => {
    const actual = this.secciones().find((seccion) => seccion.id === this.activa());
    return actual?.label ?? this.titulo();
  });

  constructor() {
    afterNextRender(() => this.observar());
  }

  protected buscar(evento: Event): void {
    this.consulta.set((evento.target as HTMLInputElement).value);
  }

  /**
   * Desplaza sin tocar la URL. Un `routerLink` con `fragment` reescribía la
   * ruta y, al recargar, el manual arrancaba a media página.
   */
  protected ir(evento: Event, id: string): void {
    evento.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activa.set(id);
    this.abierto.set(false);
  }

  /**
   * Marca el apartado que se está leyendo. El observador mira contra el panel
   * que hace scroll, no contra la ventana: en este aplicativo la ventana no se
   * desplaza nunca.
   */
  private observar(): void {
    const secciones = this.secciones()
      .map((seccion) => document.getElementById(seccion.id))
      .filter((elemento): elemento is HTMLElement => elemento !== null);
    if (secciones.length === 0) return;

    const panel = this.host.nativeElement.closest('.main') as HTMLElement | null;
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) this.activa.set(visible.target.id);
      },
      // La franja superior del panel es «lo que se está leyendo».
      { root: panel, rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );

    for (const seccion of secciones) observador.observe(seccion);
    this.activa.set(secciones[0].id);
    this.destruccion.onDestroy(() => observador.disconnect());
  }
}
