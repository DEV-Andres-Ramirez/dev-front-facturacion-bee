// Entorno de DESARROLLO (usado por `ng serve` y el build de desarrollo).
// En producción, angular.json reemplaza este archivo por environment.production.ts.
import type { AppEnvironment } from './environment.model';

export type { AppEnvironment };

export const environment: AppEnvironment = {
  production: false,
  appName: 'Facturación Bee',
  org: 'Bee Consultoría y Negocios',
  tagline: 'The power of creating together',
  supabase: {
    url: 'https://xatapilakdhlmgfjvdco.supabase.co',
    publishableKey: 'sb_publishable_HZWD8n_MoHC1FgqKCzhL5w_69jMqQf_',
  },
  api: {
    url: 'http://localhost:3000',
    key: '0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d',
  },
};
