import { supabase, getStoredSupabaseConfig } from './supabase';
import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { Profile, Local, Member, UserRole } from '../types';

export interface RegisterLocalParams {
  email: string;
  password: string;
  ownerName: string;
  localName: string;
  address?: string;
  phone?: string;
  plan?: string;
}

export interface RegisterMemberByWebParams {
  email: string;
  password: string;
  fullName: string;
  dni: string;
  phone?: string;
}

export interface RegisterMemberByLocalParams {
  name: string;
  dni: string;
  phone?: string;
  currentLocalId: string;
}

export interface LoginResult {
  session: Session;
  user: User;
  profile: Profile;
  role: UserRole;
  local: Local | null;
  member: Member | null;
  activeLocales: Local[];
}

/**
 * Authenticates a user by email or DNI.
 * - If identifier is purely numbers, transforms it to `${identifier.trim()}@acuva.app`.
 * - If identifier is an email, passes it directly.
 * - Fetches profile from `profiles` table to determine user role.
 * - Loads related row from `locales` if role is 'local'.
 * - Loads member data and active local(s) if role is 'miembro'.
 */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const trimmedIdentifier = identifier.trim();
  const isNumericDni = /^\d+$/.test(trimmedIdentifier);
  const email = isNumericDni ? `${trimmedIdentifier}@acuva.app` : trimmedIdentifier;

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    throw authError;
  }

  if (!authData.session || !authData.user) {
    throw new Error('No se pudo establecer la sesión de usuario.');
  }

  const { session, user } = authData;

  // Consultar la tabla profiles por id = session.user.id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || 'Perfil de usuario no encontrado en la base de datos.');
  }

  let local: Local | null = null;
  let member: Member | null = null;
  let activeLocales: Local[] = [];

  if (profile.role === 'local') {
    // Cargar información de su fila en locales
    let { data: localData, error: localError } = await supabase
      .from('locales')
      .select('*')
      .eq('profile_id', session.user.id)
      .maybeSingle();

    if (!localData && !localError) {
      const { data: fallbackLocal } = await supabase
        .from('locales')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (fallbackLocal) {
        localData = fallbackLocal;
      }
    }

    if (localError) {
      console.error('Error al cargar la información del local:', localError);
    }

    local = localData;
  } else if (profile.role === 'miembro') {
    // Cargar datos de miembros
    let { data: memberData, error: memberError } = await supabase
      .from('miembros')
      .select('*')
      .eq('profile_id', session.user.id)
      .maybeSingle();

    if (!memberData && profile.dni) {
      const { data: dniMember } = await supabase
        .from('miembros')
        .select('*')
        .eq('dni', profile.dni)
        .maybeSingle();

      if (dniMember) {
        memberData = dniMember;
      }
    }

    if (!memberData) {
      const { data: idMember } = await supabase
        .from('miembros')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (idMember) {
        memberData = idMember;
      }
    }

    if (memberError) {
      console.error('Error al cargar los datos del miembro:', memberError);
    }

    member = memberData;

    // Cargar el o los locales en los que está activo
    const localIds: string[] = [];

    if (member?.locals_id && Array.isArray(member.locals_id)) {
      localIds.push(...member.locals_id);
    }

    if (member?.id) {
      try {
        const { data: relations } = await supabase
          .from('locales_miembros')
          .select('local_id, status')
          .eq('miembro_id', member.id)
          .eq('status', 'active');

        if (relations && relations.length > 0) {
          for (const rel of relations) {
            if (rel.local_id && !localIds.includes(rel.local_id)) {
              localIds.push(rel.local_id);
            }
          }
        }
      } catch {
        // Ignorar si no existe la tabla relacional
      }
    }

    if (localIds.length > 0) {
      const { data: localesData, error: localesError } = await supabase
        .from('locales')
        .select('*')
        .in('id', localIds);

      if (!localesError && localesData) {
        activeLocales = localesData;
      }
    }
  }

  return {
    session,
    user,
    profile,
    role: profile.role,
    local,
    member,
    activeLocales,
  };
}

/**
 * Registers a new local (gym / business).
 */
export async function registerLocal(data: RegisterLocalParams) {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: {
      data: {
        role: 'local',
        full_name: data.ownerName,
        local_name: data.localName,
        address: data.address,
        phone: data.phone,
        plan: data.plan,
        max_members: 100,
      },
    },
  });

  if (error) {
    throw error;
  }

  return authData;
}

/**
 * Registers a new member directly via the web portal.
 */
export async function registerMemberByWeb(data: RegisterMemberByWebParams) {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: {
      data: {
        role: 'miembro',
        full_name: data.fullName,
        dni: data.dni.trim(),
        phone: data.phone,
        is_claimed: true,
      },
    },
  });

  if (error) {
    throw error;
  }

  return authData;
}

/**
 * Registers a new member from a local (gym) admin context.
 * Creates the member in Supabase Auth using synthetic email and initial DNI password,
 * with metadata specifying role, full_name, dni, phone, is_claimed: false, and created_by_local_id.
 * Uses an isolated auth client (persistSession: false) so the current admin session is not lost.
 */
export async function registerMemberByLocal(data: RegisterMemberByLocalParams) {
  const trimmedDni = data.dni.trim();
  const email = `${trimmedDni}@acuva.app`;
  const password = trimmedDni;
  const trimmedPhone = data.phone?.trim() || undefined;

  const { url, anonKey, isConfigured } = getStoredSupabaseConfig();
  const supabaseUrl = url || import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (!isConfigured && !supabaseUrl) {
    console.warn('Supabase no está configurado. Omitiendo registro en Supabase Auth.');
    return null;
  }

  const authClient = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : supabase;

  const { data: authData, error } = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'miembro',
        full_name: data.name.trim(),
        dni: trimmedDni,
        phone: trimmedPhone,
        is_claimed: false,
        created_by_local_id: data.currentLocalId,
      },
    },
  });

  if (error) {
    throw error;
  }

  return authData;
}

/**
 * Loads the current local record for the active session, with fallback.
 */
export async function getCurrentLocal(): Promise<Local | null> {
  const session = await getCurrentSession();
  if (!session?.user) {
    const cached = localStorage.getItem('acuva_current_local');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return null;
  }

  let { data: localData, error: localError } = await supabase
    .from('locales')
    .select('*')
    .eq('profile_id', session.user.id)
    .maybeSingle();

  if (!localData && !localError) {
    const { data: fallbackLocal } = await supabase
      .from('locales')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fallbackLocal) {
      localData = fallbackLocal;
    }
  }

  if (localData) {
    localStorage.setItem('acuva_current_local', JSON.stringify(localData));
    return localData;
  }

  const defaultLocal: Local = {
    id: session.user.id,
    profile_id: session.user.id,
    email: session.user.email || '',
    owner_name: session.user.user_metadata?.full_name || '',
    name: session.user.user_metadata?.local_name || 'Mi Gimnasio',
    max_members: 100,
    plan: 'standard',
    linked_members_count: 0,
    members_id: [],
  };

  localStorage.setItem('acuva_current_local', JSON.stringify(defaultLocal));
  return defaultLocal;
}

/**
 * Closes current Supabase auth session.
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Returns current active session if any.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}

/**
 * Returns current authenticated user if any.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return user;
}

export { supabase };

