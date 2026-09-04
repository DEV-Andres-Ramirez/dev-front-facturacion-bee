import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { SemanticTone } from '@core/models';
import { IconComponent, IconName } from '../icon/icon';

/** Ancho de la tarjeta. `sm` para confirmar, `lg` para leer un detalle largo. */
export type AnchoModal = 'sm' | 'md' | 'lg';

const ANCHO: Record<AnchoModal, string> = {
  sm: 'modal-sm',
  md: '',
  lg: 'modal-lg',
};

const TONO_ICONO: Record<SemanticTone, string> = {
  ok: 'ic-ok',
  info: 'ic-info',
  bad: 'ic-bad',
  warn: 'ic-warn',
  primary: 'ic-primary',
  neutral: 'ic-ink',
};

/** Lo que el navegador considera enfocable dentro del diálogo. */
const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'details > summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Cuántos diálogos hay abiertos. Con diálogos anidados, el primero en cerrarse
 * no debe devolverle el scroll al fondo mientras el otro sigue abierto.
 */
let abiertos = 0;

/**
 * Diálogo modal del sistema de diseño.
 *
 * Sustituye a los ocho `.modal-veil` que estaban escritos a mano por las
 * pantallas. Ninguno atrapaba el foco, ninguno cerraba con `Escape`, en ninguno
 * se podía pulsar el velo y todos dejaban que el fondo siguiera desplazándose
 * por detrás — que es parte del mismo problema de scroll que arrastraba la
 * aplicación.
 *
 * Se monta y se desmonta con un `@if`, así que su ciclo de vida **es** el de
 * apertura y cierre: no hace falta una entrada `abierto`.
 *
 * ```html
 * @if (confirmando()) {
 *   <bee-modal titulo="Enviar correos" icono="send" tono="warn" (cerrar)="cancelar()">
 *     <p>¿Seguro?</p>
 *     <ng-container acciones>
 *       <button class="btn-sm btn-ghost" (click)="cancelar()">Cancelar</button>
 *       <button class="btn-sm btn-honey" (click)="confirmar()">Sí, enviar</button>
 *     </ng-container>
 *   </bee-modal>
 * }
 * ```
 */
@Component({
  selector: 'bee-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '(document:keydown.escape)': 'alEscape($event)',
  },
  template: `
    <div class="modal-veil" (mousedown)="alVelo($event)">
      <div
        #tarjeta
        class="modal-card"
        [class]="anchoClase()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="idTitulo"
        (keydown.tab)="alTabular($event)"
      >
        <div class="modal-h">
          @if (icono(); as nombre) {
            <span class="modal-ic" [class]="tonoClase()">
              <bee-icon [name]="nombre" [size]="18" />
            </span>
          }
          <div [id]="idTitulo" class="ct">{{ titulo() }}</div>
          <div class="sp"></div>
          @if (cerrable()) {
            <button class="modal-x" type="button" aria-label="Cerrar" (click)="pedirCierre()">
              <bee-icon name="x" [size]="17" />
            </button>
          }
        </div>

        <div class="modal-body">
          <ng-content />
        </div>

        <div class="modal-actions">
          <ng-content select="[acciones]" />
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly icono = input<IconName | null>(null);
  readonly tono = input<SemanticTone>('neutral');
  readonly ancho = input<AnchoModal>('md');
  /** En `false` no hay aspa, ni `Escape`, ni cierre al pulsar el velo. */
  readonly cerrable = input(true);

  /** Petición de cierre: velo, aspa o `Escape`. Quien lo usa decide si cierra. */
  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-t-${Math.random().toString(36).slice(2, 9)}`;
  protected readonly anchoClase = computed(() => ANCHO[this.ancho()]);
  protected readonly tonoClase = computed(() => TONO_ICONO[this.tono()]);

  private readonly tarjeta = viewChild.required<ElementRef<HTMLElement>>('tarjeta');
  /** A dónde devolver el foco al cerrar: casi siempre, el botón que lo abrió. */
  private readonly origenFoco = document.activeElement as HTMLElement | null;

  constructor() {
    if (abiertos === 0) document.body.classList.add('scroll-bloqueado');
    abiertos++;

    afterNextRender(() => this.enfocarPrimero());

    inject(DestroyRef).onDestroy(() => {
      abiertos = Math.max(0, abiertos - 1);
      if (abiertos === 0) document.body.classList.remove('scroll-bloqueado');
      this.origenFoco?.focus?.();
    });
  }

  protected alEscape(evento: Event): void {
    if (!this.cerrable()) return;
    evento.preventDefault();
    this.cerrar.emit();
  }

  /** Solo cierra si el gesto empezó en el velo, no al arrastrar desde dentro. */
  protected alVelo(evento: MouseEvent): void {
    if (!this.cerrable()) return;
    if (evento.target === evento.currentTarget) this.cerrar.emit();
  }

  protected pedirCierre(): void {
    this.cerrar.emit();
  }

  /**
   * Encierra el tabulador dentro del diálogo. Sin esto el foco se escapa al
   * fondo, que sigue ahí aunque no se vea: para quien navega con teclado o con
   * lector de pantalla, el diálogo no llega a ser modal.
   */
  protected alTabular(evento: Event): void {
    const teclado = evento as KeyboardEvent;
    const focos = this.enfocables();
    if (focos.length === 0) return;

    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    const activo = document.activeElement;

    if (
      teclado.shiftKey &&
      (activo === primero || !this.tarjeta().nativeElement.contains(activo))
    ) {
      teclado.preventDefault();
      ultimo.focus();
    } else if (!teclado.shiftKey && activo === ultimo) {
      teclado.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    return Array.from(
      this.tarjeta().nativeElement.querySelectorAll<HTMLElement>(ENFOCABLES),
    ).filter((elemento) => elemento.offsetParent !== null || elemento === document.activeElement);
  }

  /** Prefiere el primer campo; si no hay, la propia tarjeta. */
  private enfocarPrimero(): void {
    const focos = this.enfocables();
    const campo = focos.find((elemento) => /^(INPUT|TEXTAREA|SELECT)$/.test(elemento.tagName));
    const destino = campo ?? focos[0];
    if (destino) {
      destino.focus();
      return;
    }
    const tarjeta = this.tarjeta().nativeElement;
    tarjeta.tabIndex = -1;
    tarjeta.focus();
  }
}
