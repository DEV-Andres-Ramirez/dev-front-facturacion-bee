import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeComponent, IconComponent } from '@shared/ui';

/** Manual Técnico: arquitectura, datos e integraciones (solo administradores). */
@Component({
  selector: 'app-manual-tecnico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, IconComponent],
  templateUrl: './manual-tecnico.html',
  styleUrl: './manual.css',
})
export class ManualTecnico {
  protected readonly secciones = [
    { id: 'stack', label: '1 · Visión general y stack' },
    { id: 'estructura', label: '2 · Estructura del proyecto' },
    { id: 'rutas', label: '3 · Enrutamiento y seguridad' },
    { id: 'estado', label: '4 · Gestión de estado' },
    { id: 'datos', label: '5 · Base de datos (Supabase)' },
    { id: 'storage', label: '6 · Storage de archivos' },
    { id: 'excel', label: '7 · Procesamiento de Excel' },
    { id: 'correo', label: '8 · Integración de correo' },
    { id: 'despliegue', label: '9 · Entornos y despliegue' },
    { id: 'convenciones', label: '10 · Convenciones y pendientes' },
  ];
}
