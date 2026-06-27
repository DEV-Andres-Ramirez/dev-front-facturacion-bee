import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Data, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { PeriodStore } from '@core/services/period.store';
import { PeriodId } from '@core/models';
import { BeeMarkComponent, IconComponent, IconName } from '@shared/ui';

interface NavItem {
  readonly label: string;
  readonly icon: IconName;
  readonly route: string;
  readonly auto?: boolean;
  readonly adminOnly?: boolean;
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const NAV: readonly NavGroup[] = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', icon: 'dashboard', route: 'dashboard' },
      { label: 'Carga de documentos', icon: 'upload', route: 'carga' },
    ],
  },
  {
    title: 'Ciclo de facturación',
    items: [
      { label: 'Validar información', icon: 'validate', route: 'validar', auto: true },
      { label: 'Agregar talentos', icon: 'talents', route: 'talentos', auto: true },
      { label: 'Agrupar información', icon: 'group', route: 'agrupar', auto: true },
      { label: 'Revisar facturas', icon: 'review', route: 'revisar', auto: true },
      { label: 'Entregar al cliente', icon: 'send', route: 'entregar', auto: true },
      { label: 'Conciliar cuentas', icon: 'reconcile', route: 'conciliar', auto: true },
      { label: 'Guardar registros', icon: 'records', route: 'registros', auto: true },
    ],
  },
  {
    title: 'Administración',
    items: [
      { label: 'Gestión de usuarios', icon: 'users', route: 'usuarios', adminOnly: true },
      { label: 'Auditoría y logs', icon: 'audit', route: 'auditoria', adminOnly: true },
    ],
  },
];

/** Estructura de la aplicación: barra lateral + encabezado + área de contenido. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, BeeMarkComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly periodStore = inject(PeriodStore);

  protected readonly user = this.auth.user;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly sidebarOpen = signal(false);

  /** Grupos de navegación visibles según el rol (RF-AUT-02). */
  protected readonly groups = computed<readonly NavGroup[]>(() => {
    const admin = this.isAdmin();
    return NAV.map((group) => ({
      title: group.title,
      items: group.items.filter((item) => !item.adminOnly || admin),
    })).filter((group) => group.items.length > 0);
  });

  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.deepestData()),
      startWith(this.deepestData()),
    ),
    { initialValue: {} as Data },
  );

  protected readonly title = computed(() => (this.routeData()['title'] as string) ?? 'Facturación Bee');
  protected readonly subtitle = computed(() => (this.routeData()['subtitle'] as string) ?? '');

  protected onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PeriodId;
    this.periodStore.setPeriod(value);
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private deepestData(): Data {
    let active = this.route.firstChild;
    while (active?.firstChild) active = active.firstChild;
    return active?.snapshot?.data ?? {};
  }
}
