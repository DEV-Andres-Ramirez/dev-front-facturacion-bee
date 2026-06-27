// Lee las variables generadas desde .env (build-time) y las expone tipadas.
// Importar siempre como `import { environment } from '@env'`.
import { RAW_ENV } from './environment.generated';

function str(key: string, fallback = ''): string {
  const value = RAW_ENV[key];
  return value === undefined || value === '' ? fallback : value;
}

function int(key: string, fallback: number): number {
  const value = Number.parseInt(RAW_ENV[key] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

function float(key: string, fallback: number): number {
  const value = Number.parseFloat(RAW_ENV[key] ?? '');
  return Number.isFinite(value) ? value : fallback;
}

/** Configuración tipada de la aplicación, derivada de `.env`. */
export interface AppEnvironment {
  readonly appName: string;
  readonly org: string;
  readonly tagline: string;
  readonly production: boolean;
  readonly auth: {
    readonly tokenAdmin: string;
    readonly tokenUsuario: string;
    readonly sessionTtlMinutes: number;
    readonly maxLoginAttempts: number;
  };
  readonly billing: {
    readonly defaultClient: string;
    readonly retentionRate: number;
    readonly currency: string;
    readonly reportCurrency: string;
    readonly paymentTermDays: number;
    readonly invoicePrefix: string;
    readonly invoiceLastSequence: number;
  };
  readonly mail: {
    readonly client: string;
    readonly approver: string;
    readonly projects: string;
    readonly finance: string;
    readonly operations: string;
  };
  readonly docRepositoryUrl: string;
}

export const environment: AppEnvironment = {
  appName: str('APP_NAME', 'Facturación Bee'),
  org: str('APP_ORG', 'Bee Consultoría y Negocios'),
  tagline: str('APP_TAGLINE', 'The power of creating together'),
  production: str('APP_ENV', 'development') === 'production',
  auth: {
    tokenAdmin: str('AUTH_TOKEN_ADMIN'),
    tokenUsuario: str('AUTH_TOKEN_USUARIO'),
    sessionTtlMinutes: int('AUTH_SESSION_TTL_MINUTES', 30),
    maxLoginAttempts: int('AUTH_MAX_LOGIN_ATTEMPTS', 5),
  },
  billing: {
    defaultClient: str('BILLING_CLIENT_DEFAULT', 'Acme Global'),
    retentionRate: float('BILLING_RETENTION_RATE', 0.125),
    currency: str('BILLING_CURRENCY', 'USD'),
    reportCurrency: str('BILLING_REPORT_CURRENCY', 'COP'),
    paymentTermDays: int('BILLING_PAYMENT_TERM_DAYS', 30),
    invoicePrefix: str('INVOICE_PREFIX', 'BEE'),
    invoiceLastSequence: int('INVOICE_LAST_SEQUENCE', 0),
  },
  mail: {
    client: str('MAIL_CLIENT'),
    approver: str('MAIL_APPROVER'),
    projects: str('MAIL_PROJECTS'),
    finance: str('MAIL_FINANCE'),
    operations: str('MAIL_OPERATIONS'),
  },
  docRepositoryUrl: str('DOC_REPOSITORY_URL'),
};
