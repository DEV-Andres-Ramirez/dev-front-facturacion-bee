import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BadgeComponent,
  CicloComponent,
  IconComponent,
  SeccionManual,
  TocComponent,
} from '@shared/ui';

/**
 * Manual de Usuario: guía completa de uso del aplicativo (RF-DOC).
 *
 * El índice lleva `claves` además de la etiqueta para que el buscador encuentre
 * un apartado por lo que la persona recuerda —«no me llega el correo»,
 * «anular»— y no solo por su título.
 */
@Component({
  selector: 'app-manual-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, CicloComponent, IconComponent, TocComponent],
  templateUrl: './manual-usuario.html',
  styleUrl: './manual.css',
})
export class ManualUsuario {
  protected readonly secciones: readonly SeccionManual[] = [
    { id: 'bienvenida', label: '1 · Bienvenida', claves: 'inicio qué es introducción' },
    {
      id: 'primeros-pasos',
      label: '2 · Primeros pasos',
      claves: 'entrar sesión periodo menú notificaciones',
    },
    { id: 'roles', label: '3 · Roles y permisos', claves: 'administrador usuario permisos' },
    { id: 'ciclo', label: '4 · El ciclo de facturación', claves: 'etapas fases avance bloqueo' },
    { id: 'dashboard', label: '5 · Dashboard', claves: 'tablero indicadores gráficos resumen' },
    {
      id: 'carga',
      label: '6 · Carga de documentos',
      claves: 'subir excel prefactura pedido novedades',
    },
    { id: 'validar', label: '7 · Validar información', claves: 'cotejar diferencias montos' },
    { id: 'agrupar', label: '8 · Agrupar información', claves: 'secuencial consolidar' },
    {
      id: 'revisar',
      label: '9 · Revisar facturas',
      claves: 'factura bee monto emitido fecha anular',
    },
    {
      id: 'entregar',
      label: '10 · Entregar al cliente',
      claves: 'correo enviar copias adjuntos buzón reenvío',
    },
    {
      id: 'conciliar',
      label: '11 · Conciliar cuentas',
      claves: 'pago trm retención vencida anular',
    },
    { id: 'registros', label: '12 · Guardar registros', claves: 'archivo descargar zip soportes' },
    {
      id: 'numeracion',
      label: '13 · Numeración de facturas',
      claves: 'secuencial consecutivo numero anular anulada repetido reutilizar',
    },
    {
      id: 'administracion',
      label: '14 · Administración',
      claves: 'usuarios auditoría logs periodos',
    },
    { id: 'ejemplo', label: '15 · Ejemplo completo', claves: 'paso a paso mes cierre' },
    { id: 'faq', label: '16 · Preguntas frecuentes', claves: 'error problema ayuda no funciona' },
  ];
}
