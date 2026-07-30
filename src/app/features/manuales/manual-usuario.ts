import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeComponent, IconComponent, ProcessStepperComponent } from '@shared/ui';

/** Manual de Usuario: guía completa de uso del aplicativo (RF-DOC). */
@Component({
  selector: 'app-manual-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, IconComponent, ProcessStepperComponent],
  templateUrl: './manual-usuario.html',
  styleUrl: './manual.css',
})
export class ManualUsuario {
  protected readonly secciones = [
    { id: 'bienvenida', label: '1 · Bienvenida' },
    { id: 'primeros-pasos', label: '2 · Primeros pasos' },
    { id: 'roles', label: '3 · Roles y permisos' },
    { id: 'ciclo', label: '4 · El ciclo de facturación' },
    { id: 'carga', label: '5 · Carga de documentos' },
    { id: 'validar', label: '6 · Validar información' },
    { id: 'agrupar', label: '7 · Agrupar información' },
    { id: 'revisar', label: '8 · Revisar facturas' },
    { id: 'entregar', label: '9 · Entregar al cliente' },
    { id: 'ejemplo', label: '10 · Ejemplo completo' },
    { id: 'administracion', label: '11 · Administración' },
    { id: 'faq', label: '12 · Preguntas frecuentes' },
  ];
}
