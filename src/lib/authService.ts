import { supabase, getStoredSupabaseConfig } from './supabase';
import { createClient, type Session, type User } from '@supabase/supabase-js';
import type { Profile, Local, MemberProfile, UserRole, PublicLocal } from '../types';

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
}

/** Todo lo que la app necesita saber del usuario con sesión. */
export interface UserContext {
  user: User;
  profile: Profile;
  role: UserRole;
  local: Local | null;
  /** La persona (tabla miembros). La membresía de cada local se carga aparte. */
  member: MemberProfile | null;
  activeLocales: Local[];
}

export interface LoginResult extends UserContext {
  session: Session;
}

/** Los DNI se loguean con un email sintético. */
export function identifierToEmail(identifier: string): string {
  const trimmed = identifier.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}@acuva.app` : trimmed;
}

/**
 * Autentica por email o DNI y resuelve rol, local y datos de socio.
 */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: identifierToEmail(identifier),
    password,
  });

  if (authError) {
    throw authError;
  }

  if (!authData.session || !authData.user) {
    throw new Error('No se pudo establecer la sesión de usuario.');
  }

  const context = await resolveUserContext(authData.user);
  return { ...context, session: authData.session };
}

/**
 * Carga profile, rol y relaciones del usuario autenticado.
 * - role 'local': su fila en `locales`.
 * - role 'miembro': su persona en `miembros` y los locales donde está activo.
 */
export async function resolveUserContext(user: User): Promise<UserContext> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message || 'Perfil de usuario no encontrado en la base de datos.');
  }

  let local: Local | null = null;
  let member: MemberProfile | null = null;
  let activeLocales: Local[] = [];

  if (profile.role === 'local') {
    local = await fetchOwnLocal(user.id);
  } else if (profile.role === 'miembro') {
    member = await fetchOwnMember(user.id);
    activeLocales = member ? await fetchActiveLocalesForMember(member.id) : [];
  }

  return {
    user,
    profile,
    role: profile.role,
    local,
    member,
    activeLocales,
  };
}

/** Restaura el contexto de la sesión guardada (al recargar la página). */
export async function getSessionContext(): Promise<UserContext | null> {
  const { url, isConfigured } = getStoredSupabaseConfig();
  if (!isConfigured && !url && !import.meta.env.VITE_SUPABASE_URL) {
    return null;
  }

  const session = await getCurrentSession();
  if (!session?.user) {
    return null;
  }
  return resolveUserContext(session.user);
}

async function fetchOwnLocal(userId: string): Promise<Local | null> {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error al cargar la información del local:', error);
  }
  return (data as Local) || null;
}

async function fetchOwnMember(userId: string): Promise<MemberProfile | null> {
  const { data, error } = await supabase
    .from('miembros')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error al cargar los datos del socio:', error);
  }
  return (data as MemberProfile) || null;
}

async function fetchActiveLocalesForMember(memberId: string): Promise<Local[]> {
  const { data: relations, error } = await supabase
    .from('local_miembros')
    .select('local_id')
    .eq('miembro_id', memberId)
    .eq('status', 'activo');

  if (error || !relations || relations.length === 0) {
    return [];
  }

  const { data: localesData, error: localesError } = await supabase
    .from('locales')
    .select('*')
    .in('id', relations.map((r) => r.local_id));

  if (localesError || !localesData) {
    return [];
  }

  return (localesData as Local[]).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ---------------------------------------------------------------------------
// Locales: URL pública, vínculo y cupo
// ---------------------------------------------------------------------------

/** Datos públicos del local para /{slug}. Devuelve null si no existe. */
export async function getLocalBySlug(slug: string): Promise<PublicLocal | null> {
  const { data, error } = await supabase.rpc('get_local_by_slug', { p_slug: slug });
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return { ...(data as PublicLocal), id: String((data as PublicLocal).id) };
}

/** El socio con sesión se suma al local del slug (controla el cupo en la base). */
export async function joinLocal(slug: string): Promise<'VINCULADO' | 'YA_VINCULADO'> {
  const { data, error } = await supabase.rpc('join_local', { p_slug: slug });
  if (error) {
    throw error;
  }
  return (data as { estado: 'VINCULADO' | 'YA_VINCULADO' }).estado;
}

/** El local cambia su link. Devuelve el slug normalizado que quedó guardado. */
export async function updateLocalSlug(slug: string): Promise<string> {
  const { data, error } = await supabase.rpc('update_local_slug', { p_slug: slug });
  if (error) {
    throw error;
  }
  return data as string;
}

export function isLocalFull(local: Pick<Local, 'linked_members_count' | 'max_members'> | null): boolean {
  if (!local) return false;
  return (local.linked_members_count ?? 0) >= (local.max_members ?? 0);
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

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
 * Alta de un socio desde el panel del local.
 * 1) El local pide un token de un solo uso (prepare_member_signup), que
 *    valida cupo y DNI.
 * 2) Se crea la cuenta en Auth con email DNI@acuva.app y contraseña = DNI,
 *    usando un cliente aislado para no perder la sesión del local.
 * 3) El trigger handle_new_user crea la persona y la vincula al local.
 */
export async function registerMemberByLocal(data: RegisterMemberByLocalParams) {
  const trimmedDni = data.dni.replace(/\D/g, '');
  const email = `${trimmedDni}@acuva.app`;
  const password = trimmedDni;
  const trimmedPhone = data.phone?.trim() || undefined;

  const { url, anonKey } = getStoredSupabaseConfig();
  const supabaseUrl = url || import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('La base de datos no está configurada.');
  }

  const { data: token, error: tokenError } = await supabase.rpc('prepare_member_signup', {
    p_dni: trimmedDni,
  });
  if (tokenError) {
    throw new Error(authErrorMessage(tokenError));
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'acuva-alta-socio',
    },
  });

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
        alta_token: token,
      },
    },
  });

  if (error) {
    if (error.message?.includes('User already registered')) {
      throw new Error(
        'Ese DNI ya tiene cuenta en Acuva. Si es socio de otro gimnasio, pedile que escanee el QR de tu local para sumarse.'
      );
    }
    throw new Error(authErrorMessage(error));
  }

  if (!authData.user) {
    throw new Error('No se pudo crear la cuenta del socio. Probá de nuevo.');
  }

  return authData;
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

/**
 * Carga el local de la sesión activa.
 */
export async function getCurrentLocal(): Promise<Local | null> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return null;
  }
  return fetchOwnLocal(session.user.id);
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

// ---------------------------------------------------------------------------
// Mensajes de error para la UI
// ---------------------------------------------------------------------------

const RPC_MESSAGES: Record<string, string> = {
  CUPO_LLENO: 'Este local alcanzó el cupo de socios de su plan. Consultá en recepción.',
  YA_ES_SOCIO: 'Esa persona ya es socia de tu gimnasio.',
  DNI_INVALIDO: 'Revisá el DNI: tiene que tener entre 6 y 9 números.',
  ALTA_INVALIDA: 'El alta venció o ya se usó. Volvé a intentarlo.',
  DNI_EN_OTRO_LOCAL:
    'Ese DNI ya es socio de otro gimnasio en Acuva. Pedile que escanee el QR de tu local para sumarse.',
  DNI_EN_USO:
    'Ese DNI ya tiene una cuenta. Ingresá con tu DNI como usuario y contraseña, o consultá en recepción.',
  FALTA_DNI: 'Tu cuenta no tiene DNI cargado. Consultá en recepción.',
  LOCAL_NO_ENCONTRADO: 'No encontramos este local. Revisá el link o pedile el QR a tu gimnasio.',
  SOLO_SOCIOS: 'Esta cuenta es de un gimnasio. Para sumarte como socio usá una cuenta de socio.',
  PERFIL_NO_ENCONTRADO: 'No encontramos tu perfil. Volvé a ingresar o consultá en recepción.',
  NO_AUTENTICADO: 'Tu sesión expiró. Volvé a ingresar.',
  NO_ES_LOCAL: 'Esta acción es solo para cuentas de gimnasio.',
  SOCIO_NO_ENCONTRADO: 'No encontramos la ficha del socio. Recargá la página y probá de nuevo.',
  SOCIO_NO_VINCULADO: 'Ese socio no pertenece a tu local.',
  SLUG_INVALIDO: 'El link tiene que tener entre 3 y 40 caracteres: letras, números y guiones.',
  SLUG_RESERVADO: 'Ese link está reservado por Acuva. Probá con otro.',
  SLUG_EN_USO: 'Ese link ya lo usa otro local. Probá con otro.',
};

export function authErrorMessage(err: unknown, fallback = 'Algo salió mal. Probá de nuevo.'): string {
  const raw = (err as { message?: string })?.message || '';

  for (const [code, message] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return message;
  }

  if (raw.includes('Invalid login credentials')) {
    return 'El usuario o la contraseña no coinciden. Si sos socio, probá con tu DNI en los dos campos.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Todavía no confirmaste tu email. Revisá tu casilla (y spam) y después ingresá.';
  }
  if (raw.includes('User already registered')) {
    return 'Ya existe una cuenta con ese email. Ingresá con tu contraseña.';
  }
  if (raw.includes('Password should be at least')) {
    return 'La contraseña tiene que tener al menos 6 caracteres.';
  }
  if (raw.includes('Database error saving new user')) {
    return 'No se pudo crear la cuenta. Puede que ese DNI ya esté registrado o que el gimnasio haya llegado a su cupo.';
  }
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
  }
  if (raw.includes('supabaseUrl is required')) {
    return 'La base de datos no está configurada.';
  }

  return raw || fallback;
}

export { supabase };
