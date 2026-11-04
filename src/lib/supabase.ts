import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import esquemaMultilocalSql from '../../supabase/01_esquema_multilocal.sql?raw';

export type { User, Session };

// Local storage keys for customizable Supabase connection in case env vars are provided in UI
const STORAGE_KEY_URL = 'acuva_supabase_url';
const STORAGE_KEY_ANON = 'acuva_supabase_anon';

// Migrate legacy ringo supabase storage keys if present
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const oldUrl = localStorage.getItem('ringo_supabase_url');
    if (oldUrl && !localStorage.getItem(STORAGE_KEY_URL)) {
      localStorage.setItem(STORAGE_KEY_URL, oldUrl);
    }
    const oldAnon = localStorage.getItem('ringo_supabase_anon');
    if (oldAnon && !localStorage.getItem(STORAGE_KEY_ANON)) {
      localStorage.setItem(STORAGE_KEY_ANON, oldAnon);
    }
  } catch {
    // Ignore storage migration errors
  }
}

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const savedAnon = localStorage.getItem(STORAGE_KEY_ANON) || envAnon;

  return {
    url: savedUrl.trim(),
    anonKey: savedAnon.trim(),
    isConfigured: Boolean(savedUrl.trim() && savedAnon.trim())
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
}

export function clearStoredSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getStoredSupabaseConfig();
  if (!isConfigured) return null;

  try {
    if (!supabaseInstance) {
      supabaseInstance = createClient(url, anonKey);
    }
    return supabaseInstance;
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client =
      getSupabase() ||
      createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      );
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export function resetSupabaseClient() {
  supabaseInstance = null;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, anonKey);
    // Attempt lightweight query or auth check
    const { error } = await testClient.from('miembros').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's connected to Supabase project!
      if (error.message?.includes('relation "public.miembros" does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado a Supabase correctamente. Falta ejecutar el script SQL para crear las tablas.'
        };
      }
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
    return {
      success: true,
      message: '¡Conexión exitosa con la base de datos Supabase!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'No se pudo conectar a Supabase'
    };
  }
}

export async function signInAdmin(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase no está configurado. Conecta la base de datos primero.');
  }
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpAdmin(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase no está configurado. Conecta la base de datos primero.');
  }
  return await supabase.auth.signUp({ email, password });
}

export async function signOutAdmin() {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function getCurrentAdminUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/**
 * Script SQL para el editor de Supabase (crea o actualiza el esquema multi-local).
 * Fuente única: supabase/01_esquema_multilocal.sql
 */
export const SUPABASE_SQL_SCRIPT: string = esquemaMultilocalSql;
