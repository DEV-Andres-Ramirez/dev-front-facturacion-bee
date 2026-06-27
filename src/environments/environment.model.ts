/** Configuración tipada de la aplicación, resuelta por entorno (file replacement). */
export interface AppEnvironment {
  readonly production: boolean;
  readonly appName: string;
  readonly org: string;
  readonly tagline: string;
  /**
   * Conexión a Supabase. La `publishableKey` es pública por diseño (su acceso
   * está limitado por las políticas RLS), por eso puede versionarse aquí.
   * Las claves secretas (service_role, DB) NUNCA van en el frontend.
   */
  readonly supabase: {
    readonly url: string;
    readonly publishableKey: string;
  };
}
