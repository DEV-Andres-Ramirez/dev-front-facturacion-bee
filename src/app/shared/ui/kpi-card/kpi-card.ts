import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Kpi, SemanticTone } from '@core/models';
import { IconComponent, IconName } from '../icon/icon';

const ACCENT: Record<SemanticTone, string> = {
  ok: 'accent-ok',
  info: 'accent-info',
  bad: 'accent-bad',
  warn: 'accent-honey',
  primary: 'accent-honey',
  neutral: '',
};

const ICON_BG: Record<SemanticTone, string> = {
  ok: 'ic-ok',
  info: 'ic-info',
  bad: 'ic-bad',
  warn: 'ic-honey',
  primary: 'ic-primary',
  neutral: 'ic-ink',
};

const VALUE_COLOR: Record<SemanticTone, string> = {
  ok: 't-ok',
  info: 't-info',
  bad: 't-bad',
  warn: 't-honey',
  primary: '',
  neutral: '',
};

/** Tarjeta de indicador clave del tablero (RF-DSH-01). */
@Component({
  selector: 'bee-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="kpi" [class]="accentClass()">
      <div class="kh">
        <span class="kl">{{ kpi().label }}</span>
        <span class="ki" [class]="iconBgClass()">
          <bee-icon [name]="iconName()" [size]="18" />
        </span>
      </div>
      <div class="kv" [class]="valueColorClass()">{{ kpi().value }}</div>
      <div class="kc">{{ kpi().caption }}</div>
    </div>
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<Kpi>();

  protected readonly accentClass = computed(() => ACCENT[this.kpi().tone]);
  protected readonly iconBgClass = computed(() => ICON_BG[this.kpi().tone]);
  protected readonly valueColorClass = computed(() => VALUE_COLOR[this.kpi().tone]);
  protected readonly iconName = computed(() => this.kpi().icon as IconName);
}
