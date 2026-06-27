import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingDataService } from '@core/services/billing-data.service';
import { ValidationLine } from '@core/models';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Cotejo de la prefactura contra el registro interno · MODO DEMO (Mayo 2026). */
@Component({
  selector: 'app-validar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './validar-demo.html',
})
export class ValidarDemo {
  private readonly billing = inject(BillingDataService);

  protected readonly validation = this.billing.validation;

  /** Diferencia de monto de una discrepancia (prefactura − registro interno). */
  protected delta(line: ValidationLine): number {
    return Math.abs(line.prefactura - (line.registroInterno ?? 0));
  }
}
