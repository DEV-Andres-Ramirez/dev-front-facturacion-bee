import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PuntoSerie } from './modelo';

const ANCHO = 320;
const ALTO = 110;
const MARGEN = 8;

interface Nodo {
  readonly x: number;
  readonly y: number;
  readonly punto: PuntoSerie;
}

/**
 * Serie por periodo: la única vista del aplicativo que cruza meses.
 *
 * Con un solo periodo no hay evolución que enseñar, así que en ese caso se
 * dibuja igualmente el punto: decir «faltan datos» sería más útil que una
 * línea recta inventada, y eso lo decide quien la monta.
 */
@Component({
  selector: 'bee-serie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="serie"
      [attr.viewBox]="'0 0 ' + ancho + ' ' + alto"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="resumen()"
    >
      <defs>
        <linearGradient id="beeSerieRelleno" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--honey)" stop-opacity="0.32" />
          <stop offset="100%" stop-color="var(--honey)" stop-opacity="0" />
        </linearGradient>
      </defs>

      @if (area()) {
        <path class="s-area" [attr.d]="area()" />
      }
      @if (linea()) {
        <path class="s-linea" [attr.d]="linea()" />
      }
      @for (nodo of nodos(); track nodo.punto.etiqueta) {
        <circle class="s-punto" [attr.cx]="nodo.x" [attr.cy]="nodo.y" r="3.5">
          <title>{{ nodo.punto.etiqueta }}: {{ nodo.punto.detalle ?? nodo.punto.valor }}</title>
        </circle>
      }
    </svg>

    <div class="s-ejes">
      @for (punto of puntos(); track punto.etiqueta) {
        <span class="s-eje">{{ punto.etiqueta }}</span>
      }
    </div>
  `,
  styleUrl: './grafico.css',
})
export class SerieComponent {
  readonly puntos = input.required<readonly PuntoSerie[]>();

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;

  protected readonly nodos = computed<Nodo[]>(() => {
    const puntos = this.puntos();
    if (puntos.length === 0) return [];
    const maximo = Math.max(1, ...puntos.map((p) => p.valor));
    const util = ALTO - MARGEN * 2;
    const paso = puntos.length > 1 ? (ANCHO - MARGEN * 2) / (puntos.length - 1) : 0;
    return puntos.map((punto, i) => ({
      punto,
      x: puntos.length > 1 ? MARGEN + paso * i : ANCHO / 2,
      y: ALTO - MARGEN - (punto.valor / maximo) * util,
    }));
  });

  protected readonly linea = computed(() => {
    const nodos = this.nodos();
    if (nodos.length < 2) return '';
    return nodos
      .map((n, i) => `${i === 0 ? 'M' : 'L'}${n.x.toFixed(1)},${n.y.toFixed(1)}`)
      .join(' ');
  });

  protected readonly area = computed(() => {
    const nodos = this.nodos();
    if (nodos.length < 2) return '';
    const base = ALTO - MARGEN;
    return (
      `M${nodos[0].x.toFixed(1)},${base} ` +
      nodos.map((n) => `L${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ') +
      ` L${nodos[nodos.length - 1].x.toFixed(1)},${base} Z`
    );
  });

  protected readonly resumen = computed(() =>
    this.puntos()
      .map((p) => `${p.etiqueta}: ${p.detalle ?? p.valor}`)
      .join(', '),
  );
}
