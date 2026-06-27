import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../icon/icon';

/**
 * Estado vacío de marca para periodos sin iniciar (Junio 2026) o secciones sin
 * datos. Muestra un icono, título, mensaje y una acción opcional de navegación.
 */
@Component({
  selector: 'bee-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="empty-state">
      <span class="es-ic">
        <bee-icon [name]="icon()" [size]="30" [strokeWidth]="1.7" />
      </span>
      <h3 class="es-title">{{ title() }}</h3>
      <p class="es-msg">{{ message() }}</p>
      @if (actionLabel() && actionRoute()) {
        <a class="btn-sm btn-solid es-action" [routerLink]="actionRoute()">
          {{ actionLabel() }}
          <bee-icon name="arrow-right" [size]="16" [strokeWidth]="2.2" />
        </a>
      }
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 54px 28px;
        gap: 4px;
      }
      .es-ic {
        width: 66px;
        height: 66px;
        border-radius: 18px;
        background: var(--honey-soft);
        color: var(--honey-deep);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
      }
      .es-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.3px;
        color: var(--ink);
      }
      .es-msg {
        font-size: 13px;
        color: var(--muted);
        max-width: 420px;
        line-height: 1.6;
      }
      .es-action {
        margin-top: 16px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('info');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input<string>('');
  /** Ruta destino (p. ej. ['/app','carga']) para la acción primaria. */
  readonly actionRoute = input<string[] | null>(null);
}
