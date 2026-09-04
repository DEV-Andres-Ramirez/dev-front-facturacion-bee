import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ETAPAS, ETIQUETA_ETAPA, EtapaCiclo, RUTA_ETAPA, ordenEtapa } from '@core/models';
import { IconComponent, IconName } from '../icon/icon';

/** `cinta` es la tira del encabezado; `panel` son las casillas del tablero. */
export type VarianteCiclo = 'cinta' | 'panel';

/** Icono de cada etapa. Los mismos que usa la barra lateral, para reconocerlos. */
const ICONO_ETAPA: Record<EtapaCiclo, IconName> = {
  carga: 'upload',
  validacion: 'validate',
  agrupacion: 'group',
  revision: 'review',
  entrega: 'send',
  conciliacion: 'reconcile',
  archivo: 'records',
  cerrado: 'lock',
};

/** «Cerrado» no es un paso del recorrido, es su final. */
const PASOS = ETAPAS.filter((etapa) => etapa !== 'cerrado');

/**
 * Línea del ciclo de facturación.
 *
 * Fuente única de las tres pinturas que antes existían por separado: la tira
 * del encabezado, las casillas del tablero y el `bee-process-stepper` del
 * manual —que además arrastraba su propia lista de etapas, desfasada, con
 * «Archivar» donde el resto del aplicativo dice «Registros»—.
 *
 * Las etapas, sus etiquetas y sus rutas salen siempre de `periodo.model.ts`.
 */
@Component({
  selector: 'bee-ciclo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './ciclo.html',
  styleUrl: './ciclo.css',
})
export class CicloComponent {
  readonly etapa = input.required<EtapaCiclo>();
  readonly variante = input<VarianteCiclo>('cinta');
  /** Con `false` los pasos se pintan pero no llevan a ninguna parte. */
  readonly navegable = input(true);

  protected readonly pasos = PASOS;
  protected readonly etiqueta = ETIQUETA_ETAPA;
  protected readonly ruta = RUTA_ETAPA;
  protected readonly icono = ICONO_ETAPA;

  /** En móvil la tira se resume en una píldora que se puede desplegar. */
  protected readonly desplegado = signal(false);

  /** Posición actual. Un periodo cerrado deja todos los pasos completados. */
  protected readonly indice = computed(() => {
    const orden = ordenEtapa(this.etapa());
    return orden >= PASOS.length ? PASOS.length : Math.max(0, orden);
  });

  protected readonly completo = computed(() => this.indice() >= PASOS.length);

  /**
   * Relleno del raíl, en porcentaje. Los nodos se reparten a lo ancho, así que
   * el paso `i` cae en `i / (n - 1)`: el relleno tiene que llegar hasta su
   * centro, no hasta el final de su casilla.
   */
  protected readonly avance = computed(() => {
    const tope = PASOS.length - 1;
    return Math.round((Math.min(this.indice(), tope) / tope) * 100);
  });

  /** Porcentaje real del ciclo, que es lo que se le enseña a la persona. */
  protected readonly porcentaje = computed(() =>
    Math.round((Math.min(this.indice(), PASOS.length) / PASOS.length) * 100),
  );

  protected readonly etiquetaActual = computed(() =>
    this.completo() ? 'Ciclo completado' : ETIQUETA_ETAPA[PASOS[this.indice()]],
  );

  protected estadoDe(i: number): 'hecho' | 'actual' | 'pendiente' {
    if (i < this.indice()) return 'hecho';
    return i === this.indice() ? 'actual' : 'pendiente';
  }

  protected alternar(): void {
    this.desplegado.update((abierto) => !abierto);
  }
}
