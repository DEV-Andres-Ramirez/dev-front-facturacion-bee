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
  /**
   * Backend de correo (dev-back-facturacion-bee). La `key` viaja en el bundle
   * del navegador y por tanto es pública: protege el uso casual, no es un
   * secreto. Ver la nota de seguridad en CONSUMO.md.
   */
  readonly api: {
    readonly url: string;
    readonly key: string;
  };
}
