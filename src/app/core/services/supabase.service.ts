import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '@env';

/**
 * Cliente único de Supabase para toda la aplicación (RNF-DA-01).
 * Usa la URL y la publishable key del entorno; la autorización real la imponen
 * las políticas RLS de la base de datos.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
