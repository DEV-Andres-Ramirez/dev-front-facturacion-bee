import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { BadgeComponent, IconComponent } from '@shared/ui';

/** Gestión de cuentas y matriz de permisos por rol (RF-USR). */
@Component({
  selector: 'app-usuarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, IconComponent],
  templateUrl: './usuarios.html',
})
export class Usuarios {
  private readonly billing = inject(BillingDataService);

  /** Cuentas y permisos son configuración del sistema: visibles en todo periodo. */
  protected readonly users = this.billing.users;
  protected readonly permissions = this.billing.permissions;

  protected readonly activeCount = computed(() => this.users.length);
  protected readonly adminCount = computed(() => this.users.filter((u) => u.role === 'ADMIN').length);
  protected readonly userCount = computed(() => this.users.filter((u) => u.role === 'USUARIO').length);
  protected readonly roleCount = 2;
  protected readonly sessions30d = 86;
}
