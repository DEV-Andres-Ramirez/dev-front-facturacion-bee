import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BillingDataService } from './billing-data.service';

describe('BillingDataService · módulos pendientes de conectar (dataset en blanco)', () => {
  let billing: BillingDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    billing = TestBed.inject(BillingDataService);
  });

  it('el periodo arranca en blanco (sin proceso iniciado)', () => {
    expect(billing.isBlankPeriod()).toBe(true);
    expect(billing.invoices().length).toBe(0);
    expect(billing.dataset().loading.status).toBeNull();
  });

  it('expone la matriz de permisos del sistema', () => {
    expect(billing.permissions.length).toBeGreaterThan(0);
  });
});
