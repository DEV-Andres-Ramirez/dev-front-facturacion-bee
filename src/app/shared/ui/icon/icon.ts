import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Nombres de icono disponibles en el set de la aplicación. */
export type IconName =
  | 'dashboard'
  | 'upload'
  | 'validate'
  | 'talents'
  | 'group'
  | 'review'
  | 'send'
  | 'reconcile'
  | 'records'
  | 'users'
  | 'audit'
  | 'bell'
  | 'settings'
  | 'search'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-right'
  | 'check'
  | 'clock'
  | 'alert'
  | 'alert-circle'
  | 'info'
  | 'coins'
  | 'plus'
  | 'file'
  | 'file-stack'
  | 'download'
  | 'eye'
  | 'lock'
  | 'trend'
  | 'folder'
  | 'mail'
  | 'shield'
  | 'x'
  | 'logout';

/**
 * Icono de línea (24×24, trazo `currentColor`) del sistema de diseño Bee.
 * Uso: `<bee-icon name="send" [size]="16" />`. Decorativo por defecto
 * (aria-hidden); pasar `[label]` cuando el icono transmita significado.
 */
@Component({
  selector: 'bee-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
  host: { class: 'bee-icon' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(2);
  /** Si se indica, el icono es semántico (role=img + aria-label). */
  readonly label = input<string>('');
}
