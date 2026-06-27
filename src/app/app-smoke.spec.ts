import { Type, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PeriodStore } from '@core/services/period.store';
import { SupabaseService } from '@core/services/supabase.service';

import { Shell } from './layout/shell/shell';
import { Dashboard } from './features/dashboard/dashboard';
import { Carga } from './features/carga/carga';
import { Validar } from './features/validar/validar';
import { Agrupar } from './features/agrupar/agrupar';
import { Revisar } from './features/revisar/revisar';
import { Entregar } from './features/entregar/entregar';
import { Conciliar } from './features/conciliar/conciliar';
import { Registros } from './features/registros/registros';
import { Usuarios } from './features/usuarios/usuarios';
import { Auditoria } from './features/auditoria/auditoria';

// Mock mínimo del cliente Supabase (sin red) para las pantallas que lo usan.
function makeQuery(result: unknown) {
  const q: Record<string, unknown> = {
    select: () => q,
    insert: () => q,
    update: () => q,
    eq: () => q,
    order: () => q,
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return q;
}
const supabaseMock = {
  client: {
    from: () => makeQuery({ data: [], error: null }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
};

const ADMIN_SESSION = {
  user: {
    id: '1',
    name: 'Administrador',
    initials: 'AD',
    email: 'admin@beeconsultoria.com',
    area: 'Facturación',
    role: 'ADMIN',
    status: 'Activa',
    lastAccess: '—',
    avatar: 'ink',
  },
};

const SCREENS: Array<[string, Type<unknown>]> = [
  ['Shell', Shell],
  ['Dashboard', Dashboard],
  ['Carga', Carga],
  ['Validar', Validar],
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
    localStorage.setItem('bee.session', JSON.stringify(ADMIN_SESSION));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });
  });

  afterEach(() => localStorage.clear());

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
