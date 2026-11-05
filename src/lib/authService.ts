import { supabase, getStoredSupabaseConfig } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
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

export interface CreateMemberByLocalParams {
  name: string;
  dni: string;
  phone?: string;
  /** El local le habilita el ingreso a la app con DNI + contraseña. */
  accesoApp: boolean;
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

/** Un identificador de solo números es un DNI; si no, es un email. */
export function isDniIdentifier(identifier: string): boolean {
  return /^\d+$/.test(identifier.trim());
}

/**
 * Se lanza cuando el DNI está habilitado pero todavía no tiene contraseña:
 * la pantalla tiene que pedir que la repita y volver a llamar a login().
 */
export class FirstLoginRequiredError extends Error {
  constructor() {
    super('PRIMER_INGRESO');
    this.name = 'FirstLoginRequiredError';
  }
}

type MemberLoginResponse =
  | { status: 'OK'; session: { access_token: string; refresh_token: string } }
  | { status: 'FIRST_LOGIN_REQUIRED' }
  | { status: 'ERROR'; code: string };

/**
 * Ingreso con DNI. Pasa por la Edge Function member-login, que limita los
 * intentos por DNI e IP y crea la cuenta en el primer ingreso.
 */
async function signInWithDni(
  dni: string,
  password: string,
  passwordConfirm?: string
): Promise<{ session: Session; user: User }> {
  const { data, error } = await supabase.functions.invoke('member-login', {
    body: {
      dni: dni.trim(),
      password,
      ...(passwordConfirm !== undefined ? { password_confirm: passwordConfirm } : {}),
    },
  });

  if (error) {
    throw error;
  }

  const result = data as MemberLoginResponse | null;
  if (!result) {
    throw new Error('SERVIDOR');
  }
  if (result.status === 'FIRST_LOGIN_REQUIRED') {
    throw new FirstLoginRequiredError();
  }
  if (result.status === 'ERROR') {
    throw new Error(result.code);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: result.session.access_token,
    refresh_token: result.session.refresh_token,
  });
  if (sessionError) {
    throw sessionError;
  }
  if (!sessionData.session || !sessionData.user) {
    throw new Error('No se pudo establecer la sesión de usuario.');
  }
  return { session: sessionData.session, user: sessionData.user };
}

/**
 * Autentica por email o DNI y resuelve rol, local y datos de socio.
 * - Email: Supabase Auth (gimnasios y socios verificados).
 * - DNI: member-login (socios básicos). Si es el primer ingreso lanza
 *   FirstLoginRequiredError; volver a llamar con passwordConfirm.
 */
export async function login(
  identifier: string,
  password: string,
  passwordConfirm?: string
): Promise<LoginResult> {
  let session: Session;
  let user: User;

  if (isDniIdentifier(identifier)) {
    ({ session, user } = await signInWithDni(identifier, password, passwordConfirm));
  } else {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });

    if (authError) {
      throw authError;
    }
    if (!authData.session || !authData.user) {
      throw new Error('No se pudo establecer la sesión de usuario.');
    }
    session = authData.session;
    user = authData.user;
  }

  const context = await resolveUserContext(user);
  return { ...context, session };
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
 * Crea solo la ficha (miembros + local_miembros) con control de cupo, por
 * RPC. No crea usuario en Auth: si el local habilita el acceso, el socio crea
 * su contraseña en su primer ingreso con DNI (Edge Function member-login).
 */
export async function createMemberByLocal(data: CreateMemberByLocalParams): Promise<{ memberId: string }> {
  const { data: result, error } = await supabase.rpc('create_member_by_local', {
    p_dni: data.dni.replace(/\D/g, ''),
    p_nombre: data.name.trim(),
    p_telefono: data.phone?.trim() || null,
    p_acceso: data.accesoApp,
  });

  if (error) {
    throw new Error(authErrorMessage(error));
  }

  const memberId = (result as { miembro_id?: string } | null)?.miembro_id;
  if (!memberId) {
    throw new Error('No se pudo crear al socio. Probá de nuevo.');
  }
  return { memberId };
}

/** El local habilita o quita el ingreso a la app con DNI + contraseña. */
export async function setMemberAccess(memberId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_member_access', {
    p_miembro_id: memberId,
    p_acceso: enabled,
  });
  if (error) {
    throw new Error(authErrorMessage(error));
  }
}

/**
 * El local restablece la contraseña de un socio básico: en su próximo
 * ingreso con DNI elige una nueva. Un socio verificado no se puede
 * restablecer desde acá (usa su email).
 */
export async function resetMemberPassword(memberId: string): Promise<'REINICIADO' | 'SIN_CUENTA'> {
  const { data, error } = await supabase.rpc('reset_member_password', { p_miembro_id: memberId });
  if (error) {
    throw new Error(authErrorMessage(error));
  }
  return data as 'REINICIADO' | 'SIN_CUENTA';
}

// ---------------------------------------------------------------------------
// Verificación del email (de básico a verificado)
// ---------------------------------------------------------------------------

const RESERVED_EMAIL_DOMAIN = '@acuva.app';

/**
 * El socio con sesión pide cambiar el email de su usuario de Auth por el
 * real. Supabase manda un link de confirmación a esa casilla; recién al
 * confirmar cambia el email (el id del usuario no cambia) y un trigger marca
 * la cuenta como verificada. Hasta entonces sigue entrando con su DNI.
 */
export async function linkMemberEmail(email: string): Promise<string> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('EMAIL_INVALIDO');
  }
  if (trimmed.endsWith(RESERVED_EMAIL_DOMAIN)) {
    throw new Error('EMAIL_RESERVADO');
  }

  const { error } = await supabase.auth.updateUser(
    { email: trimmed },
    { emailRedirectTo: `${window.location.origin}/` }
  );
  if (error) {
    throw error;
  }
  return trimmed;
}

/** Email que el socio pidió vincular y todavía no confirmó, si hay uno. */
export async function getPendingEmail(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user?.new_email ?? null;
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
  NOMBRE_REQUERIDO: 'Completá el nombre del socio.',
  ALTA_INVALIDA: 'El alta venció o ya se usó. Volvé a intentarlo.',
  DNI_EN_OTRO_LOCAL:
    'Ese DNI ya es socio de otro gimnasio en Acuva. Pedile que escanee el QR de tu local para sumarse.',
  DNI_EN_USO:
    'Ese DNI ya tiene una cuenta. Ingresá con tu DNI como usuario y contraseña, o consultá en recepción.',
  SOCIO_VERIFICADO:
    'Este socio ya vinculó su email. Si olvidó la contraseña, tiene que recuperarla con su email.',
  // member-login
  CREDENCIALES_INVALIDAS:
    'El DNI o la contraseña no coinciden, o tu gimnasio todavía no te habilitó el acceso a la app.',
  DEMASIADOS_INTENTOS: 'Hiciste demasiados intentos. Esperá unos 15 minutos y probá de nuevo.',
  PASSWORD_NO_COINCIDE: 'Las dos contraseñas no coinciden. Escribilas de nuevo.',
  PASSWORD_CORTA: 'La contraseña tiene que tener al menos 8 caracteres.',
  PASSWORD_ES_DNI: 'Elegí una contraseña distinta de tu DNI.',
  PASSWORD_DEBIL: 'Esa contraseña es muy fácil de adivinar. Elegí otra, con letras y números.',
  CUENTA_INCONSISTENTE: 'Tu cuenta quedó a medias. Avisale a tu gimnasio para que te la restablezca.',
  SERVIDOR: 'No pudimos iniciar sesión por un problema nuestro. Probá de nuevo en un rato.',
  // Vinculación de email
  EMAIL_INVALIDO: 'Revisá el email: no parece válido.',
  EMAIL_RESERVADO: 'Ese email no se puede usar. Probá con otro.',
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
    return 'El email o la contraseña no coinciden. Revisalos y probá de nuevo.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Todavía no confirmaste tu email. Revisá tu casilla (y spam) y después ingresá.';
  }
  if (raw.includes('User already registered')) {
    return 'Ya existe una cuenta con ese email. Ingresá con tu contraseña.';
  }
  if (raw.includes('already been registered') || raw.includes('email_exists')) {
    return 'Ese email ya lo usa otra cuenta. Probá con otro.';
  }
  const minLength = raw.match(/Password should be at least (\d+)/);
  if (minLength) {
    return `La contraseña tiene que tener al menos ${minLength[1]} caracteres.`;
  }
  if (raw.includes('Database error saving new user')) {
    return 'No se pudo crear la cuenta. Puede que ese DNI ya esté registrado o que el gimnasio haya llegado a su cupo.';
  }
  if (raw.includes('Database error updating user')) {
    return 'No pudimos cambiar el email. Probá con otro.';
  }
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('Failed to send a request')) {
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
  }
  if (raw.includes('non-2xx status code') || raw.includes('Requested function was not found')) {
    return 'El ingreso con DNI no está disponible en este momento. Probá de nuevo en un rato o consultá en recepción.';
  }
  if (raw.includes('supabaseUrl is required')) {
    return 'La base de datos no está configurada.';
  }

  return raw || fallback;
}

export { supabase };
