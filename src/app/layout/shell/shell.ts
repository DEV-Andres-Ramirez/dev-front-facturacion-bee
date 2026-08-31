import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Data, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { AuditoriaService } from '@core/services/auditoria.service';
import { PeriodStore } from '@core/services/period.store';
import { PeriodosService } from '@core/services/periodos.service';
import { NotificacionesService } from '@core/services/notificaciones.service';
import { FacturasService } from '@core/services/facturas.service';
import { ParametrosService } from '@core/services/parametros.service';
import {
  ETAPAS,
  ETIQUETA_ETAPA,
  EtapaCiclo,
  MESES,
  Notificacion,
  PeriodoId,
  ordenEtapa,
} from '@core/models';
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
    items: [{ label: 'Dashboard', icon: 'dashboard', route: 'dashboard' }],
  },
  {
    title: 'Ciclo de facturación',
    items: [
      { label: 'Carga de documentos', icon: 'upload', route: 'carga' },
      { label: 'Validar información', icon: 'validate', route: 'validar', auto: true },
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
  {
    title: 'Documentación',
    items: [
      { label: 'Manual de Usuario', icon: 'book', route: 'manual-usuario' },
      { label: 'Manual Técnico', icon: 'code', route: 'manual-tecnico', adminOnly: true },
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
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly auditoria = inject(AuditoriaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly periodStore = inject(PeriodStore);
  private readonly periodos = inject(PeriodosService);
  private readonly facturas = inject(FacturasService);
  private readonly parametros = inject(ParametrosService);
  private readonly notificacionesService = inject(NotificacionesService);

  protected readonly user = this.auth.user;
  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly sidebarOpen = signal(false);

  // ── Línea del ciclo, transversal a todo el tablero ──────────────────────────

  /** Etapas visibles en el encabezado; «cerrado» no es un paso, es un final. */
  protected readonly etapasCiclo = ETAPAS.filter((e) => e !== 'cerrado');
  protected readonly etiquetaEtapa = ETIQUETA_ETAPA;
  protected readonly etapaActual = this.periodStore.etapa;

  protected readonly indiceEtapa = computed(() => {
    const actual = ordenEtapa(this.etapaActual());
    // Un periodo cerrado deja todos los pasos completados.
    return actual >= this.etapasCiclo.length ? this.etapasCiclo.length : actual;
  });

  // ── Centro de notificaciones ────────────────────────────────────────────────

  protected readonly notificaciones = this.notificacionesService.notificaciones;
  protected readonly totalNotificaciones = this.notificacionesService.total;
  protected readonly panelAbierto = signal(false);

  // ── Creación de periodos (solo administradores) ─────────────────────────────

  protected readonly meses = MESES;
  protected readonly modalPeriodo = signal(false);
  protected readonly creando = signal(false);
  protected readonly errorPeriodo = signal('');
  protected readonly confirmarPeriodo = signal(false);

  private readonly hoy = new Date();
  protected readonly anioNuevo = signal(this.hoy.getFullYear());
  protected readonly mesNuevo = signal(this.hoy.getMonth() + 2 > 12 ? 1 : this.hoy.getMonth() + 2);

  /** Años ofrecidos: el actual y el siguiente, que cubre el cierre de diciembre. */
  protected readonly aniosDisponibles = [this.hoy.getFullYear(), this.hoy.getFullYear() + 1];

  protected readonly etiquetaNueva = computed(() =>
    this.periodos.etiqueta(this.anioNuevo(), this.mesNuevo()),
  );
  protected readonly yaExiste = computed(() =>
    this.periodos.existe(this.anioNuevo(), this.mesNuevo()),
  );

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
      map(() => {
        // Mantiene actualizado el último acceso del usuario al navegar (RF-USR).
        this.auth.touch();
        return this.deepestData();
      }),
      startWith(this.deepestData()),
    ),
    { initialValue: {} as Data },
  );

  protected readonly title = computed(() => (this.routeData()['title'] as string) ?? 'Facturación Bee');
  protected readonly subtitle = computed(() => (this.routeData()['subtitle'] as string) ?? '');

  protected onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PeriodoId;
    const anterior = this.periodStore.label();
    this.periodStore.setPeriod(value);

    this.auditoria.registrar({
      modulo: 'Periodo',
      accion: 'CAMBIAR_PERIODO',
      observacion: `Cambió el periodo de trabajo de ${anterior} a ${this.periodStore.label()}.`,
      entidad: 'periodo',
      referencia: value,
      detalle: { anterior, nuevo: this.periodStore.label() },
    });

    void this.cargarFacturasDelPeriodo();
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected logout(): void {
    // El evento se registra ANTES de cerrar la sesión: `auth.logout()` deja el
    // usuario en null y después ya no habría a quién atribuir la acción.
    const usuario = this.auth.user();
    this.auditoria.registrar({
      modulo: 'Autenticación',
      accion: 'CIERRE_SESION',
      observacion: 'Cerró sesión en el aplicativo.',
      entidad: 'usuario',
      referencia: usuario?.email,
    });

    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  async ngOnInit(): Promise<void> {
    // El catálogo de periodos y los parámetros son transversales: se cargan una
    // vez aquí y el resto de pantallas los consume ya resueltos.
    await this.periodStore.init();
    void this.parametros.load();
    void this.cargarFacturasDelPeriodo();
  }

  // ── Notificaciones ──────────────────────────────────────────────────────────

  protected alternarPanel(): void {
    this.panelAbierto.update((abierto) => !abierto);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected atenderNotificacion(aviso: Notificacion): void {
    this.cerrarPanel();
    if (aviso.ruta) {
      void this.router.navigate(aviso.ruta);
      return;
    }
    // Sin ruta es el aviso de crear el periodo: abre el modal directamente.
    this.abrirModalPeriodo();
  }

  // ── Periodos ────────────────────────────────────────────────────────────────

  protected abrirModalPeriodo(): void {
    this.errorPeriodo.set('');
    this.confirmarPeriodo.set(false);
    this.modalPeriodo.set(true);
  }

  protected cerrarModalPeriodo(): void {
    this.modalPeriodo.set(false);
    this.confirmarPeriodo.set(false);
    this.errorPeriodo.set('');
  }

  protected setAnio(event: Event): void {
    this.anioNuevo.set(Number((event.target as HTMLSelectElement).value));
    this.errorPeriodo.set('');
    this.confirmarPeriodo.set(false);
  }

  protected setMes(event: Event): void {
    this.mesNuevo.set(Number((event.target as HTMLSelectElement).value));
    this.errorPeriodo.set('');
    this.confirmarPeriodo.set(false);
  }

  /** Primer paso: valida que no exista y pide confirmación. */
  protected pedirConfirmacion(): void {
    if (this.yaExiste()) {
      this.errorPeriodo.set(`El periodo ${this.etiquetaNueva()} ya está creado.`);
      return;
    }
    this.errorPeriodo.set('');
    this.confirmarPeriodo.set(true);
  }

  protected async crearPeriodo(): Promise<void> {
    this.creando.set(true);
    this.errorPeriodo.set('');

    const anio = this.anioNuevo();
    const mes = this.mesNuevo();
    const etiqueta = this.etiquetaNueva();
    const resultado = await this.periodos.crear(anio, mes, this.user()?.email);
    this.creando.set(false);

    this.auditoria.registrar({
      modulo: 'Periodo',
      accion: 'CREAR_PERIODO',
      resultado: resultado.ok ? 'exito' : 'error',
      observacion: resultado.ok
        ? `Creó el periodo de facturación ${etiqueta}.`
        : `No se pudo crear el periodo ${etiqueta}.`,
      entidad: 'periodo',
      referencia: etiqueta,
      detalle: { anio, mes },
    });

    if (!resultado.ok) {
      this.errorPeriodo.set(resultado.error ?? 'No se pudo crear el periodo.');
      this.confirmarPeriodo.set(false);
      return;
    }

    // Se pasa al periodo recién creado: es lo que el usuario quiere hacer ahora.
    this.periodStore.setPeriod(`${anio}-${String(mes).padStart(2, '0')}`);
    void this.cargarFacturasDelPeriodo();
    this.cerrarModalPeriodo();
  }

  private async cargarFacturasDelPeriodo(): Promise<void> {
    const etiqueta = this.periodStore.label();
    if (etiqueta) await this.facturas.load(etiqueta);
  }

  private deepestData(): Data {
    let active = this.route.firstChild;
    while (active?.firstChild) active = active.firstChild;
    return active?.snapshot?.data ?? {};
  }
}
