import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingDataService } from '@core/services/billing-data.service';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Agrupar información: consolida las líneas validadas en una factura por orden de compra (RF-AGR). */
@Component({
  selector: 'app-agrupar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './agrupar.html',
})
export class Agrupar {
  private readonly billing = inject(BillingDataService);

  protected readonly groups = this.billing.groups;

  /** Primer grupo, base del detalle de agrupación consolidado. */
  protected readonly firstGroup = computed(() => this.groups()[0]);

  /** Total de líneas validadas que se consolidan en este periodo. */
  protected readonly totalLines = computed(() =>
    this.groups().reduce((sum, group) => sum + group.lines.length, 0),
  );
}
