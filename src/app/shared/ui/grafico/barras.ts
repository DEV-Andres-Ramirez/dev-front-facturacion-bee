import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Porcion, colorDe } from './modelo';

interface Barra {
  readonly etiqueta: string;
  readonly detalle: string;
  readonly color: string;
  readonly pct: number;
}

/**
 * Barras horizontales comparativas.
 *
 * Sirve tanto para el ranking de proyectos como para los tramos de antigüedad
 * de cobro. La escala es siempre relativa al mayor valor de la serie: comparar
 * entre sí es lo que se quiere, no leer una magnitud absoluta.
 */
@Component({
  selector: 'bee-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (barra of barras(); track barra.etiqueta) {
      <div class="b-fila">
        <div class="b-cab">
          <span class="b-etq">{{ barra.etiqueta }}</span>
          <span class="b-val mono">{{ barra.detalle }}</span>
        </div>
        <div class="b-pista">
          <span
            class="b-relleno"
            [style.width.%]="barra.pct"
            [style.background]="barra.color"
          ></span>
        </div>
      </div>
    } @empty {
      <p class="note-line">Sin datos todavía.</p>
    }
  `,
  styleUrl: './grafico.css',
})
export class BarrasComponent {
  readonly datos = input.required<readonly Porcion[]>();

  protected readonly barras = computed<Barra[]>(() => {
    const datos = this.datos();
    const mayor = Math.max(1, ...datos.map((porcion) => porcion.valor));
    return datos.map((porcion, i) => ({
      etiqueta: porcion.etiqueta,
      detalle: porcion.detalle ?? String(porcion.valor),
      color: colorDe(porcion, i),
      // Un mínimo visible: una barra de 0 px no se distingue de «sin dato».
      pct: porcion.valor > 0 ? Math.max(2, Math.round((porcion.valor / mayor) * 100)) : 0,
    }));
  });
}
