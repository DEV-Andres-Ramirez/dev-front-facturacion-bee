// Entorno de PRODUCCIÓN (Vercel). Sustituye a environment.ts en el build de prod
// vía `fileReplacements` en angular.json. La publishable key es pública por diseño.
import type { AppEnvironment } from './environment.model';

export type { AppEnvironment };

export const environment: AppEnvironment = {
  production: true,
  appName: 'Facturación Bee',
  org: 'Bee Consultoría y Negocios',
  tagline: 'The power of creating together',
  supabase: {
    url: 'https://xatapilakdhlmgfjvdco.supabase.co',
    publishableKey: 'sb_publishable_HZWD8n_MoHC1FgqKCzhL5w_69jMqQf_',
  },
};
