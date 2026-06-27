import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PROCESS_STEPS } from '@core/models';

/**
 * Stepper de los 7 pasos del ciclo de facturación. `current` es el índice
 * (base 0) del paso activo: los anteriores se marcan como completados.
 */
@Component({
  selector: 'bee-process-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps" aria-label="Progreso del ciclo de facturación">
      @for (step of steps; track step.label; let i = $index; let last = $last) {
        <li
          class="step"
          [class.done]="i < current()"
          [class.cur]="i === current()"
          [attr.aria-current]="i === current() ? 'step' : null"
        >
          <span class="sn">{{ i + 1 }}</span>
          {{ step.label }}
        </li>
        @if (!last) {
          <li class="step-line" [class.done]="i < current()" aria-hidden="true"></li>
        }
      }
    </ol>
  `,
  styles: [
    `
      .steps {
        list-style: none;
      }
    `,
  ],
})
export class ProcessStepperComponent {
  readonly current = input(0);
  protected readonly steps = PROCESS_STEPS;
}
