import { Type, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PeriodStore } from '@core/services/period.store';
import { AuthService } from '@core/services/auth.service';

import { Shell } from './layout/shell/shell';
import { Dashboard } from './features/dashboard/dashboard';
import { Carga } from './features/carga/carga';
import { Validar } from './features/validar/validar';
import { Talentos } from './features/talentos/talentos';
import { Agrupar } from './features/agrupar/agrupar';
import { Revisar } from './features/revisar/revisar';
import { Entregar } from './features/entregar/entregar';
import { Conciliar } from './features/conciliar/conciliar';
import { Registros } from './features/registros/registros';
import { Usuarios } from './features/usuarios/usuarios';
import { Auditoria } from './features/auditoria/auditoria';

const SCREENS: Array<[string, Type<unknown>]> = [
  ['Shell', Shell],
  ['Dashboard', Dashboard],
  ['Carga', Carga],
  ['Validar', Validar],
  ['Talentos', Talentos],
  ['Agrupar', Agrupar],
  ['Revisar', Revisar],
  ['Entregar', Entregar],
  ['Conciliar', Conciliar],
  ['Registros', Registros],
  ['Usuarios', Usuarios],
  ['Auditoria', Auditoria],
];

describe('App smoke render', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
    TestBed.inject(AuthService).loginAs('ADMIN');
  });

  for (const [name, component] of SCREENS) {
    it(`${name} renders in Mayo and Junio without throwing`, () => {
      TestBed.inject(PeriodStore).setPeriod('2026-05');
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.length).toBeGreaterThan(0);

      TestBed.inject(PeriodStore).setPeriod('2026-06');
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  }
});
