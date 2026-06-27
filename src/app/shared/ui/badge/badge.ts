import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SemanticTone } from '@core/models';

/**
 * Píldora de estado con punto de color. Uso:
 * `<bee-badge tone="ok" label="Pagada" />` o con contenido proyectado.
 */
@Component({
  selector: 'bee-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="toneClass()">
      @if (dot()) {
        <span class="bd"></span>
      }
      @if (label()) {
        {{ label() }}
      } @else {
        <ng-content />
      }
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<SemanticTone>('neutral');
  readonly label = input<string>('');
  readonly dot = input(true);

  protected readonly toneClass = computed(() => `b-${this.tone()}`);
}
