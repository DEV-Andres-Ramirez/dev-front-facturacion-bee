import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { SupabaseService } from '@core/services/supabase.service';

const supabaseMock = {
  client: {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
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

describe('Navigation after login', () => {
  beforeEach(() => {
    localStorage.setItem('bee.session', JSON.stringify(ADMIN_SESSION));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('navega a /app/dashboard y renderiza contenido', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/app/dashboard');
    const text: string = harness.routeNativeElement?.textContent ?? '';
    expect(text.length).toBeGreaterThan(0);
  });

  it('un usuario sin sesión es redirigido al login', async () => {
    localStorage.clear();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/app/dashboard');
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
