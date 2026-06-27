import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Variante según el fondo: cuerpo carbón sobre claro, blanco sobre oscuro. */
export type BeeMarkTone = 'ink' | 'light';

/**
 * Isotipo de marca de Bee (las alas miel + el cuerpo de la abeja), recreado en
 * SVG para nitidez a cualquier tamaño. Las alas conservan el amarillo de marca;
 * el cuerpo se adapta al fondo mediante `tone`.
 */
@Component({
  selector: 'bee-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 64 64"
      fill="none"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.aria-label]="label() || null"
    >
      <path
        d="M15 12 L35 19 L22 30 Z"
        fill="#F4C41A"
        stroke="#F4C41A"
        stroke-width="6"
        stroke-linejoin="round"
      />
      <path
        d="M49 52 L29 45 L42 34 Z"
        fill="#F4C41A"
        stroke="#F4C41A"
        stroke-width="6"
        stroke-linejoin="round"
      />
      <rect
        x="11"
        y="27"
        width="42"
        height="13"
        rx="6.5"
        [attr.fill]="bodyColor()"
        transform="rotate(-38 32 33.5)"
      />
    </svg>
  `,
  host: { class: 'bee-mark' },
})
export class BeeMarkComponent {
  readonly size = input(32);
  readonly tone = input<BeeMarkTone>('ink');
  readonly label = input<string>('');

  protected readonly bodyColor = computed(() => (this.tone() === 'light' ? '#FFFFFF' : '#26282C'));
}
