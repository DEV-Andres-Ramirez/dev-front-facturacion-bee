import { Routes } from '@angular/router';
import { authGuard, adminGuard } from '@core/guards/auth.guard';

/** Rutas de la aplicación con carga diferida por característica. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },

  {
    path: 'login',
    title: 'Iniciar sesión · Facturación Bee',
    loadComponent: () => import('@features/auth/login/login').then((m) => m.Login),
  },

  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · Facturación Bee',
        data: { title: 'Dashboard', subtitle: 'Resumen del periodo de facturación' },
        loadComponent: () => import('@features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'carga',
        title: 'Carga de documentos · Facturación Bee',
        data: { title: 'Carga de documentos', subtitle: 'Importa prefactura aprobada y soportes del periodo' },
        loadComponent: () => import('@features/carga/carga').then((m) => m.Carga),
      },
      {
        path: 'validar',
        title: 'Validar información · Facturación Bee',
        data: { title: 'Validar información', subtitle: 'Coteja la prefactura aprobada contra el registro interno' },
        loadComponent: () => import('@features/validar/validar').then((m) => m.Validar),
      },
      {
        path: 'agrupar',
        title: 'Agrupar información · Facturación Bee',
        data: { title: 'Agrupar información', subtitle: 'Consolida líneas por orden de compra' },
        loadComponent: () => import('@features/agrupar/agrupar').then((m) => m.Agrupar),
      },
      {
        path: 'revisar',
        title: 'Revisar facturas · Facturación Bee',
        data: { title: 'Revisar facturas', subtitle: 'Verifica las facturas emitidas por el outsourcing' },
        loadComponent: () => import('@features/revisar/revisar').then((m) => m.Revisar),
      },
      {
        path: 'entregar',
        title: 'Entregar al cliente · Facturación Bee',
        data: { title: 'Entregar al cliente', subtitle: 'Envía la factura y sus soportes con copia controlada' },
        loadComponent: () => import('@features/entregar/entregar').then((m) => m.Entregar),
      },
      {
        path: 'conciliar',
        title: 'Conciliar cuentas · Facturación Bee',
        data: { title: 'Conciliar cuentas', subtitle: 'Concilia los pagos recibidos · retención y TRM' },
        loadComponent: () => import('@features/conciliar/conciliar').then((m) => m.Conciliar),
      },
      {
        path: 'registros',
        title: 'Guardar registros · Facturación Bee',
        data: { title: 'Guardar registros', subtitle: 'Conserva los soportes del ciclo por año y mes' },
        loadComponent: () => import('@features/registros/registros').then((m) => m.Registros),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        title: 'Gestión de usuarios · Facturación Bee',
        data: { title: 'Gestión de usuarios', subtitle: 'Administra cuentas, roles y permisos' },
        loadComponent: () => import('@features/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'auditoria',
        canActivate: [adminGuard],
        title: 'Auditoría y logs · Facturación Bee',
        data: { title: 'Auditoría y logs', subtitle: 'Bitácora de acciones del sistema' },
        loadComponent: () => import('@features/auditoria/auditoria').then((m) => m.Auditoria),
      },
    ],
  },

  { path: '**', redirectTo: 'app' },
];
