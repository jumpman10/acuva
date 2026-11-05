// ==========================================================
// ACUVA · Edge Function member-login
//
// Login de socios con DNI + contraseña, y primer ingreso.
//
//   POST { dni, password }                       → ingreso diario
//   POST { dni, password, password_confirm }     → primer ingreso: crea la
//                                                  cuenta con esa contraseña
//
// Respuestas (siempre HTTP 200 salvo error de servidor o método):
//   { status: 'OK', session: { access_token, refresh_token } }
//   { status: 'FIRST_LOGIN_REQUIRED' }   el DNI está habilitado y todavía no
//                                        tiene contraseña: pedir que la repita
//   { status: 'ERROR', code }            CREDENCIALES_INVALIDAS (genérico: DNI
//                                        inexistente, sin acceso, verificado o
//                                        contraseña incorrecta), DEMASIADOS_INTENTOS,
//                                        PASSWORD_NO_COINCIDE, PASSWORD_CORTA,
//                                        PASSWORD_ES_DNI, PASSWORD_DEBIL,
//                                        CUENTA_INCONSISTENTE, SERVIDOR
//
// El usuario de Auth de un socio básico es DNI@acuva.app. Cuando el socio
// verifica su email real, Auth le cambia el email a ese mismo usuario y esta
// función deja de aceptar su DNI (is_claimed = true).
//
// Despliegue (no necesita JWT de usuario: la protegen los límites de abajo):
//   supabase functions deploy member-login --no-verify-jwt
// Requiere haber corrido supabase/02_auth_socios.sql.
// ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Límites de intentos (valores iniciales, se pueden ajustar)
const MAX_FALLOS_DNI = 5;
const MAX_FALLOS_IP = 40; // alto a propósito: varios socios comparten el wifi del gimnasio
const VENTANA = '15 minutes';
const BLOQUEO = '15 minutes';

const PASSWORD_MIN = 8;

type ErrorCode =
  | 'CREDENCIALES_INVALIDAS'
  | 'DEMASIADOS_INTENTOS'
  | 'PASSWORD_NO_COINCIDE'
  | 'PASSWORD_CORTA'
  | 'PASSWORD_ES_DNI'
  | 'PASSWORD_DEBIL'
  | 'CUENTA_INCONSISTENTE'
  | 'SERVIDOR';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function fail(code: ErrorCode, status = 200): Response {
  return json({ status: 'ERROR', code }, status);
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'desconocida';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return fail('SERVIDOR', 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('member-login: faltan variables de entorno de Supabase');
    return fail('SERVIDOR', 500);
  }

  let body: { dni?: unknown; password?: unknown; password_confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('CREDENCIALES_INVALIDAS');
  }

  const dni = String(body?.dni ?? '').replace(/\D/g, '');
  const password = typeof body?.password === 'string' ? body.password : '';
  const passwordConfirm = typeof body?.password_confirm === 'string' ? body.password_confirm : undefined;

  const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(supabaseUrl, serviceKey, authOptions);
  const anon = createClient(supabaseUrl, anonKey, authOptions);

  const ip = clientIp(req);
  const dniKey = `dni:${dni}`;
  const ipKey = `ip:${ip}`;

  // 1. Bloqueo por intentos. Se aplica por clave aunque el DNI no exista,
  //    para no revelar qué DNIs están cargados.
  const [blockedDni, blockedIp] = await Promise.all([
    admin.rpc('acuva_login_bloqueado', { p_key: dniKey }),
    admin.rpc('acuva_login_bloqueado', { p_key: ipKey }),
  ]);
  if (blockedDni.error || blockedIp.error) {
    console.error('member-login: no se pudo consultar el bloqueo', blockedDni.error ?? blockedIp.error);
    return fail('SERVIDOR', 500);
  }
  if (blockedDni.data === true || blockedIp.data === true) {
    return fail('DEMASIADOS_INTENTOS');
  }

  const registrarFallo = async (): Promise<Response> => {
    await Promise.all([
      admin.rpc('acuva_login_fallo', { p_key: dniKey, p_max: MAX_FALLOS_DNI, p_ventana: VENTANA, p_bloqueo: BLOQUEO }),
      admin.rpc('acuva_login_fallo', { p_key: ipKey, p_max: MAX_FALLOS_IP, p_ventana: VENTANA, p_bloqueo: BLOQUEO }),
    ]);
    return fail('CREDENCIALES_INVALIDAS');
  };

  if (dni.length < 6 || dni.length > 9 || !password) {
    return registrarFallo();
  }

  // 2. La persona y si algún local le habilitó el acceso
  const { data: member, error: memberError } = await admin
    .from('miembros')
    .select('id, profile_id, is_claimed, full_name')
    .eq('dni', dni)
    .maybeSingle();
  if (memberError) {
    console.error('member-login: error al buscar al socio', memberError);
    return fail('SERVIDOR', 500);
  }
  if (!member) {
    return registrarFallo();
  }

  const { data: acceso, error: accesoError } = await admin
    .from('local_miembros')
    .select('id')
    .eq('miembro_id', member.id)
    .eq('status', 'activo')
    .eq('acceso_app', true)
    .limit(1);
  if (accesoError) {
    console.error('member-login: error al buscar el acceso', accesoError);
    return fail('SERVIDOR', 500);
  }

  // Un verificado entra con su email: su DNI ya no sirve. Misma respuesta
  // que cualquier otro fallo para no revelar nada.
  if (!acceso || acceso.length === 0 || member.is_claimed) {
    return registrarFallo();
  }

  const email = `${dni}@acuva.app`;

  // 3. Ingreso diario de un socio básico
  if (member.profile_id) {
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) {
      return registrarFallo();
    }
    await admin.rpc('acuva_login_ok', { p_key: dniKey });
    return json({
      status: 'OK',
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    });
  }

  // 4. Primer ingreso: todavía no tiene cuenta en Auth
  if (passwordConfirm === undefined) {
    // Este estado revela que el DNI está habilitado y sin contraseña. Se
    // descuenta del límite por IP para frenar el barrido de DNIs.
    await admin.rpc('acuva_login_fallo', {
      p_key: ipKey,
      p_max: MAX_FALLOS_IP,
      p_ventana: VENTANA,
      p_bloqueo: BLOQUEO,
    });
    return json({ status: 'FIRST_LOGIN_REQUIRED' });
  }

  if (password !== passwordConfirm) return fail('PASSWORD_NO_COINCIDE');
  if (password.length < PASSWORD_MIN) return fail('PASSWORD_CORTA');
  if (password === dni) return fail('PASSWORD_ES_DNI');

  // El id de la ficha va en app_metadata (el cliente no puede escribirlo).
  // El trigger handle_new_user la vincula de forma atómica: si otra solicitud
  // ganó, el trigger falla y acá no queda ninguna cuenta creada.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { link_member_id: member.id },
    user_metadata: { role: 'miembro', full_name: member.full_name ?? '', dni },
  });
  if (createError) {
    // Se registra el motivo real en los logs de la función; al socio se le
    // dice algo útil en vez de "credenciales inválidas".
    const code = (createError as { code?: string }).code ?? '';
    console.error('member-login: no se pudo crear la cuenta', code, createError.message);
    if (code === 'weak_password' || /password/i.test(createError.message)) {
      return fail('PASSWORD_DEBIL');
    }
    if (code === 'email_exists' || /already been registered/i.test(createError.message)) {
      return fail('CUENTA_INCONSISTENTE');
    }
    return fail('SERVIDOR');
  }

  const { data: created, error: createdSignInError } = await anon.auth.signInWithPassword({ email, password });
  if (createdSignInError || !created.session) {
    console.error('member-login: cuenta creada pero falló el ingreso', createdSignInError?.message);
    return fail('SERVIDOR', 500);
  }

  await admin.rpc('acuva_login_ok', { p_key: dniKey });
  return json({
    status: 'OK',
    session: {
      access_token: created.session.access_token,
      refresh_token: created.session.refresh_token,
    },
  });
});
