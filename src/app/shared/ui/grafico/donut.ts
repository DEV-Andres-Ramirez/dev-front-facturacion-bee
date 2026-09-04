import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Porcion, colorDe } from './modelo';

interface Arco {
  readonly etiqueta: string;
  readonly valor: number;
  readonly color: string;
  readonly pct: number;
  readonly largo: number;
  readonly hueco: number;
  readonly desfase: number;
}

const RADIO = 42;
const CIRC = 2 * Math.PI * RADIO;

/**
 * Anillo de reparto.
 *
 * Sustituye a la barra apilada de 12 px que había: con cuatro estados y uno de
 * ellos al 5 %, en una barra no se distinguía nada.
 */
@Component({
  selector: 'bee-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-caja">
      <svg viewBox="0 0 100 100" class="donut" [attr.aria-label]="resumen()" role="img">
        <circle class="pista" cx="50" cy="50" [attr.r]="radio" />
        @for (arco of arcos(); track arco.etiqueta) {
          <circle
            class="arco"
            cx="50"
            cy="50"
            [attr.r]="radio"
            [attr.stroke]="arco.color"
            [attr.stroke-dasharray]="arco.largo + ' ' + arco.hueco"
            [attr.stroke-dashoffset]="arco.desfase"
          >
            <title>{{ arco.etiqueta }}: {{ arco.valor }} ({{ arco.pct }}%)</title>
          </circle>
        }
      </svg>
      <div class="centro">
        <span class="c-valor mono">{{ total() }}</span>
        <span class="c-etq">{{ unidad() }}</span>
      </div>
    </div>

    <div class="leyenda">
      @for (arco of arcos(); track arco.etiqueta) {
        <div class="l-fila">
          <span class="l-punto" [style.background]="arco.color"></span>
          <span class="l-etq">{{ arco.etiqueta }}</span>
          <span class="l-val mono">{{ arco.valor }} · {{ arco.pct }}%</span>
        </div>
      }
    </div>
  `,
  styleUrl: './grafico.css',
})
export class DonutComponent {
  readonly datos = input.required<readonly Porcion[]>();
  /** Palabra bajo el total: «facturas», «pagos»… */
  readonly unidad = input('total');

  protected readonly radio = RADIO;

  protected readonly total = computed(() =>
    this.datos().reduce((suma, porcion) => suma + porcion.valor, 0),
  );

  protected readonly arcos = computed<Arco[]>(() => {
    const total = this.total();
    if (total <= 0) return [];
    let acumulado = 0;
    return this.datos()
      .filter((porcion) => porcion.valor > 0)
      .map((porcion, i) => {
        const fraccion = porcion.valor / total;
        const largo = fraccion * CIRC;
        // Un desfase negativo hace avanzar el arco: es lo que los encadena.
        const arco: Arco = {
          etiqueta: porcion.etiqueta,
          valor: porcion.valor,
          color: colorDe(porcion, i),
          pct: Math.round(fraccion * 100),
          largo,
          hueco: CIRC - largo,
          desfase: -acumulado,
        };
        acumulado += largo;
        return arco;
      });
  });

  protected readonly resumen = computed(() =>
    this.arcos()
      .map((arco) => `${arco.etiqueta}: ${arco.valor}`)
      .join(', '),
  );
}
