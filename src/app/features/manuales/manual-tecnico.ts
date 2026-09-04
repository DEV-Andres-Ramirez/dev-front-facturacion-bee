import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, SeccionManual, TocComponent } from '@shared/ui';

/** Manual Técnico: arquitectura, datos e integraciones (solo administradores). */
@Component({
  selector: 'app-manual-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, TocComponent],
  templateUrl: './manual-tecnico.html',
  styleUrl: './manual.css',
})
export class ManualTecnico {
  protected readonly secciones: readonly SeccionManual[] = [
    { id: 'stack', label: '1 · Visión general y stack', claves: 'angular nest supabase versiones' },
    {
      id: 'estructura',
      label: '2 · Estructura del proyecto',
      claves: 'carpetas core shared features alias',
    },
    { id: 'rutas', label: '3 · Enrutamiento y sesión', claves: 'guard lazy login permisos' },
    { id: 'estado', label: '4 · Gestión de estado', claves: 'signals zoneless computed effect' },
    { id: 'datos', label: '5 · Base de datos', claves: 'supabase tablas columnas rls postgres' },
    { id: 'rpc', label: '6 · Funciones RPC', claves: 'fn_ security definer sql' },
    {
      id: 'secuencial',
      label: '7 · Numeración de facturas',
      claves: 'secuencial unico numero anular anulada constraint reutilizar',
    },
    { id: 'storage', label: '8 · Storage de archivos', claves: 'bucket rutas url publica' },
    { id: 'excel', label: '9 · Excel y montos', claves: 'xlsx parseo centavos precisión' },
    {
      id: 'correo',
      label: '10 · Integración de correo',
      claves: 'smtp backend verify diagnostico adjuntos',
    },
    {
      id: 'diseno',
      label: '11 · Sistema de diseño',
      claves: 'css tokens modal ciclo graficos responsive',
    },
    {
      id: 'despliegue',
      label: '12 · Entornos y despliegue',
      claves: 'vercel environment build variables',
    },
    {
      id: 'convenciones',
      label: '13 · Convenciones y pendientes',
      claves: 'estilo idioma deuda roadmap',
    },
  ];
}
