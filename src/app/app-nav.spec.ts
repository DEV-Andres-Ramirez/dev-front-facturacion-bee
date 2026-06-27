import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from '@core/services/auth.service';

describe('Navigation after login', () => {
  it('navega a /app/dashboard y renderiza contenido', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes)],
    });
    TestBed.inject(AuthService).loginAs('ADMIN');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/app/dashboard');

    const text: string = harness.routeNativeElement?.textContent ?? '';
    // El shell + dashboard deben renderizar algo (no blanco).
    expect(text.length).toBeGreaterThan(0);
  });
});
