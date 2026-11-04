import {
  Member,
  MemberProfile,
  AccessLog,
  PaymentLog,
  DisciplineItem,
  PaymentMethod,
  PaymentMethodDetail,
  RenewMemberOptions,
  PaymentStatus,
  MembershipStatus,
} from '../types';
import { calculateNextExpiration, formatDateISO } from './dateUtils';
import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Capa de datos sobre el esquema multi-local de Supabase:
 *
 *   miembros        → persona (DNI, nombre, contacto, cuenta)
 *   local_miembros  → membresía de esa persona en un local
 *   accesos, pagos  → por local y socio
 *   disciplinas     → por local
 *
 * La UI sigue trabajando con `Member`, `AccessLog` y `PaymentLog`;
 * acá se traducen las filas de la base a esos tipos y viceversa.
 */

export const DEFAULT_DISCIPLINES: DisciplineItem[] = [
  { id: 'disc-1', nombre: 'Musculación', precio: 28000 },
  { id: 'disc-2', nombre: 'Crossfit', precio: 32000 },
  { id: 'disc-3', nombre: 'Funcional', precio: 26000 },
  { id: 'disc-4', nombre: 'Boxeo', precio: 30000 },
  { id: 'disc-5', nombre: 'Spinning', precio: 27000 },
  { id: 'disc-6', nombre: 'Pilates', precio: 29000 },
  { id: 'disc-7', nombre: 'Calistenia', precio: 25000 },
  { id: 'disc-8', nombre: 'Pase Libre', precio: 45000 },
];

// ---------------------------------------------------------------------------
// Local activo
// ---------------------------------------------------------------------------
let activeLocalId: string | null = null;

export function setActiveLocalId(id: string | null) {
  activeLocalId = id;
}

export function getActiveLocalId(): string | null {
  return activeLocalId;
}

/** Borra claves viejas del navegador (versiones anteriores guardaban datos acá). */
export function clearCachedData() {
  try {
    [
      'acuva_gym_members',
      'acuva_gym_access_logs',
      'acuva_gym_payments',
      'acuva_gym_disciplines',
      'acuva_current_local',
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore
  }
}

function db(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('La base de datos no está configurada.');
  }
  return supabase;
}

function requireLocal(): string {
  if (!activeLocalId) {
    throw new Error('No hay un local con sesión.');
  }
  return activeLocalId;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Traducción de filas
// ---------------------------------------------------------------------------
interface MembershipRow {
  id: string;
  local_id: string;
  miembro_id: string;
  status: string;
  joined_at: string;
  disciplina: string | null;
  monto_mensual: number | string | null;
  fecha_ingreso: string;
  fecha_vencimiento: string;
  estado_membresia: string;
  estado_pago: string;
  saldo_pendiente: number | string | null;
  ultimo_pago_fecha: string | null;
  notas: string | null;
  codigo_qr: string;
  miembros: MemberProfile | MemberProfile[] | null;
}

const MEMBERSHIP_SELECT = '*, miembros(*)';

function splitName(fullName: string): { nombre: string; apellido: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { nombre: parts[0] || '', apellido: parts.slice(1).join(' ') };
}

export function toMember(row: MembershipRow): Member {
  const person = (Array.isArray(row.miembros) ? row.miembros[0] : row.miembros) || ({} as MemberProfile);
  const fullName = person.full_name || '';
  const { nombre, apellido } = splitName(fullName);

  return {
    id: row.miembro_id,
    membership_id: row.id,
    local_id: row.local_id,
    dni: person.dni || '',
    nombre,
    apellido,
    full_name: fullName,
    fecha_nacimiento: person.fecha_nacimiento || undefined,
    foto_url: person.avatar_url || '',
    avatar_url: person.avatar_url || undefined,
    telefono: person.phone || '',
    phone: person.phone || undefined,
    email: person.email || undefined,
    profile_id: person.profile_id,
    is_claimed: person.is_claimed ?? false,
    disciplina: row.disciplina || 'Sin asignar',
    fecha_ingreso: row.fecha_ingreso,
    fecha_vencimiento: row.fecha_vencimiento,
    estado_membresia: (row.estado_membresia || 'activo') as MembershipStatus,
    estado_pago: (row.estado_pago || 'pendiente') as PaymentStatus,
    monto_mensual: Number(row.monto_mensual || 0),
    saldo_pendiente: Number(row.saldo_pendiente || 0),
    ultimo_pago_fecha: row.ultimo_pago_fecha || undefined,
    notas: row.notas || undefined,
    codigo_qr: row.codigo_qr,
    creado_en: row.joined_at,
  };
}

interface AccessRow {
  id: string;
  local_id: string;
  miembro_id: string;
  status: string | null;
  scanned_at: string;
  notes: string | null;
  disciplina: string | null;
  miembros?: { full_name: string | null; dni: string | null } | { full_name: string | null; dni: string | null }[] | null;
}

function toAccessLog(row: AccessRow): AccessLog {
  const person = Array.isArray(row.miembros) ? row.miembros[0] : row.miembros;
  return {
    id: row.id,
    member_id: row.miembro_id,
    dni: person?.dni || '',
    member_name: person?.full_name || '',
    disciplina: row.disciplina || '',
    timestamp: row.scanned_at,
    autorizado: row.status !== 'denegado',
    motivo: row.notes || undefined,
  };
}

interface PaymentRow {
  id: string;
  local_id: string;
  miembro_id: string;
  amount: number | string;
  payment_method: string | null;
  payment_date: string;
  period_start: string | null;
  expiration_date: string | null;
  details: PaymentMethodDetail[] | null;
  notes: string | null;
}

function toPaymentLog(row: PaymentRow): PaymentLog {
  return {
    id: row.id,
    member_id: row.miembro_id,
    fecha: (row.payment_date || '').slice(0, 10),
    monto: Number(row.amount || 0),
    metodo: row.payment_method || 'Efectivo',
    periodo_inicio: row.period_start || (row.payment_date || '').slice(0, 10),
    periodo_fin: row.expiration_date || '',
    detalles: row.details && row.details.length > 0 ? row.details : undefined,
    notas: row.notes || undefined,
  };
}

/** Campos de la persona (tabla miembros) que puede editar el local. */
function personUpdates(updates: Partial<Member>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (updates.full_name !== undefined) {
    out.full_name = updates.full_name;
  } else if (updates.nombre !== undefined || updates.apellido !== undefined) {
    out.full_name = [updates.nombre, updates.apellido].filter(Boolean).join(' ');
  }
  if (updates.phone !== undefined || updates.telefono !== undefined) {
    out.phone = updates.phone ?? updates.telefono ?? '';
  }
  if (updates.fecha_nacimiento !== undefined) {
    out.fecha_nacimiento = updates.fecha_nacimiento || null;
  }
  if (updates.foto_url !== undefined || updates.avatar_url !== undefined) {
    out.avatar_url = (updates.foto_url ?? updates.avatar_url) || null;
  }
  return out;
}

/** Campos de la membresía (tabla local_miembros). */
function membershipUpdates(updates: Partial<Member>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = [
    'disciplina',
    'monto_mensual',
    'fecha_ingreso',
    'fecha_vencimiento',
    'estado_membresia',
    'estado_pago',
    'saldo_pendiente',
    'ultimo_pago_fecha',
    'notas',
  ] as const;
  keys.forEach((key) => {
    if (updates[key] !== undefined) {
      out[key] = updates[key] === '' ? null : updates[key];
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Disciplinas (por local)
// ---------------------------------------------------------------------------
export async function fetchDisciplines(): Promise<DisciplineItem[]> {
  if (!activeLocalId) return DEFAULT_DISCIPLINES;

  const { data, error } = await db()
    .from('disciplinas')
    .select('id, nombre, precio')
    .eq('local_id', activeLocalId)
    .order('nombre');

  if (error) {
    console.error('No se pudieron cargar las disciplinas', error);
    return [];
  }
  return (data || []).map((d) => ({ id: d.id, nombre: d.nombre, precio: Number(d.precio) }));
}

export async function saveDiscipline(item: Omit<DisciplineItem, 'id'> & { id?: string }): Promise<DisciplineItem> {
  const localId = requireLocal();
  const payload = { nombre: item.nombre.trim(), precio: Number(item.precio) };

  const query =
    item.id && UUID_PATTERN.test(item.id)
      ? db().from('disciplinas').update(payload).eq('id', item.id).eq('local_id', localId)
      : db().from('disciplinas').insert([{ ...payload, local_id: localId }]);

  const { data, error } = await query.select('id, nombre, precio').single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe una disciplina llamada «${payload.nombre}».`);
    }
    throw error;
  }
  return { id: data.id, nombre: data.nombre, precio: Number(data.precio) };
}

export async function deleteDiscipline(id: string): Promise<boolean> {
  const localId = requireLocal();
  const { error } = await db().from('disciplinas').delete().eq('id', id).eq('local_id', localId);
  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------
// Socios del local
// ---------------------------------------------------------------------------
export async function fetchMembers(): Promise<Member[]> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('local_miembros')
    .select(MEMBERSHIP_SELECT)
    .eq('local_id', localId)
    .eq('status', 'activo')
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as MembershipRow[]).map(toMember);
}

async function fetchMember(memberId: string): Promise<Member | null> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('local_miembros')
    .select(MEMBERSHIP_SELECT)
    .eq('local_id', localId)
    .eq('miembro_id', memberId)
    .maybeSingle();

  if (error) throw error;
  return data ? toMember(data as MembershipRow) : null;
}

/** Membresía del socio con sesión en un local (portal del socio). */
export async function fetchMyMembership(localId: string, memberId: string): Promise<Member | null> {
  const { data, error } = await db()
    .from('local_miembros')
    .select(MEMBERSHIP_SELECT)
    .eq('local_id', localId)
    .eq('miembro_id', memberId)
    .eq('status', 'activo')
    .maybeSingle();

  if (error) throw error;
  return data ? toMember(data as MembershipRow) : null;
}

export type NewMemberData = Omit<Member, 'id' | 'codigo_qr' | 'creado_en' | 'fecha_vencimiento'> & {
  fecha_vencimiento?: string;
};

/**
 * Completa la ficha de un socio recién dado de alta desde el panel.
 * La persona y el vínculo con el local ya los creó el trigger de alta
 * (handle_new_user) al hacer el signUp con alta_token; acá se cargan los
 * datos del formulario y, si pagó, el primer pago.
 */
export async function createMember(memberData: NewMemberData): Promise<Member> {
  const localId = requireLocal();
  if (!memberData.profile_id) {
    throw new Error('No se pudo crear la cuenta del socio. Probá de nuevo.');
  }

  const { data: person, error: personError } = await db()
    .from('miembros')
    .select('id')
    .eq('profile_id', memberData.profile_id)
    .maybeSingle();

  if (personError) throw personError;
  if (!person) {
    throw new Error('La cuenta del socio se creó pero no quedó vinculada a tu local. Recargá la página.');
  }

  const fechaVencimiento = memberData.fecha_vencimiento || calculateNextExpiration(memberData.fecha_ingreso);
  const isPagado = memberData.estado_pago === 'pagado';

  const personPatch = personUpdates(memberData);
  delete personPatch.full_name; // ya viene del signUp
  if (Object.keys(personPatch).length > 0) {
    const { error } = await db().from('miembros').update(personPatch).eq('id', person.id);
    if (error) throw error;
  }

  const { error: membershipError } = await db()
    .from('local_miembros')
    .update({
      ...membershipUpdates({ ...memberData, fecha_vencimiento: fechaVencimiento }),
      ultimo_pago_fecha: isPagado ? memberData.fecha_ingreso : null,
    })
    .eq('local_id', localId)
    .eq('miembro_id', person.id);
  if (membershipError) throw membershipError;

  if (isPagado) {
    await logPayment({
      member_id: person.id,
      fecha: memberData.fecha_ingreso,
      monto: Number(memberData.monto_mensual),
      metodo: (memberData.metodo_pago as PaymentMethod) || 'Efectivo',
      periodo_inicio: memberData.fecha_ingreso,
      periodo_fin: fechaVencimiento,
    });
  }

  const created = await fetchMember(person.id);
  if (!created) {
    throw new Error('No encontramos al socio recién creado. Recargá la página.');
  }
  return created;
}

export async function updateMember(
  id: string,
  updates: Partial<Member>,
  options?: { skipPaymentLog?: boolean }
): Promise<Member | null> {
  const localId = requireLocal();
  const previous = await fetchMember(id);
  if (!previous) return null;

  const merged: Partial<Member> = { ...updates };
  if (updates.fecha_ingreso && !updates.fecha_vencimiento) {
    merged.fecha_vencimiento = calculateNextExpiration(updates.fecha_ingreso);
  }

  const becamePagado = updates.estado_pago === 'pagado' && previous.estado_pago !== 'pagado';
  if (becamePagado && !updates.ultimo_pago_fecha) {
    merged.ultimo_pago_fecha = formatDateISO(new Date());
  }

  const personPatch = personUpdates(merged);
  if (Object.keys(personPatch).length > 0) {
    const { error } = await db().from('miembros').update(personPatch).eq('id', id);
    if (error) throw error;
  }

  const membershipPatch = membershipUpdates(merged);
  if (Object.keys(membershipPatch).length > 0) {
    const { error } = await db()
      .from('local_miembros')
      .update(membershipPatch)
      .eq('local_id', localId)
      .eq('miembro_id', id);
    if (error) throw error;
  }

  const updated = { ...previous, ...merged } as Member;

  if (becamePagado && !options?.skipPaymentLog) {
    const today = formatDateISO(new Date());
    await logPayment({
      member_id: id,
      fecha: today,
      monto: Number(updated.monto_mensual) || 0,
      metodo: (updates.metodo_pago as PaymentMethod) || 'Efectivo',
      periodo_inicio: today,
      periodo_fin: updated.fecha_vencimiento,
    });
  }

  return updated;
}

/**
 * Quita al socio del local. La persona solo se borra si no queda en otro
 * local y nunca personalizó su cuenta (lo resuelve la base).
 */
export async function deleteMember(id: string): Promise<boolean> {
  const { error } = await db().rpc('remove_member_from_local', { p_miembro_id: id });
  if (error) throw error;
  return true;
}

export async function renewMemberMembership(
  memberId: string,
  options?: RenewMemberOptions
): Promise<Member | null>;
export async function renewMemberMembership(
  memberId: string,
  monto?: number,
  legacyMetodo?: PaymentMethod
): Promise<Member | null>;
export async function renewMemberMembership(
  memberId: string,
  optionsOrMonto?: RenewMemberOptions | number,
  legacyMetodo: PaymentMethod = 'Efectivo'
): Promise<Member | null> {
  let monto: number | undefined;
  let metodo: PaymentMethod | string = legacyMetodo;
  let detalles: PaymentMethodDetail[] | undefined;
  let disciplina: string | undefined;
  let fechaRenovacion: string | undefined;
  let fechaVencimiento: string | undefined;
  let saldoPendiente: number | undefined;
  let esPagoSaldo: boolean | undefined;
  let notas: string | undefined;

  if (typeof optionsOrMonto === 'number') {
    monto = optionsOrMonto;
    metodo = legacyMetodo;
  } else if (typeof optionsOrMonto === 'object' && optionsOrMonto !== null) {
    monto = optionsOrMonto.monto;
    metodo = optionsOrMonto.metodo || 'Efectivo';
    detalles = optionsOrMonto.detalles;
    disciplina = optionsOrMonto.disciplina;
    fechaRenovacion = optionsOrMonto.fechaRenovacion;
    fechaVencimiento = optionsOrMonto.fechaVencimiento;
    saldoPendiente = optionsOrMonto.saldoPendiente;
    esPagoSaldo = optionsOrMonto.esPagoSaldo;
    notas = optionsOrMonto.notas;
  }

  const member = await fetchMember(memberId);
  if (!member) return null;

  const today = formatDateISO(new Date());
  const renewalDate = fechaRenovacion || today;

  // Case A: Paying off existing pending balance only
  if (esPagoSaldo) {
    const nuevoSaldo = Math.max(0, (member.saldo_pendiente || 0) - (monto || 0));
    const updates: Partial<Member> = {
      saldo_pendiente: nuevoSaldo,
      estado_pago: nuevoSaldo === 0 ? 'pagado' : 'parcial',
      ultimo_pago_fecha: renewalDate,
    };

    const updated = await updateMember(memberId, updates, { skipPaymentLog: true });

    await logPayment({
      member_id: memberId,
      fecha: renewalDate,
      monto: monto || 0,
      metodo: metodo as PaymentMethod,
      periodo_inicio: member.fecha_ingreso,
      periodo_fin: member.fecha_vencimiento,
      detalles: detalles && detalles.length > 0 ? detalles : undefined,
      notas: notas || `Cancelación de saldo pendiente (Restante: $${nuevoSaldo})`,
    });

    return updated;
  }

  // Case B: Membership renewal (full or partial)
  const baseDate =
    member.fecha_vencimiento && member.fecha_vencimiento >= renewalDate ? member.fecha_vencimiento : renewalDate;

  const newExpiration = fechaVencimiento || calculateNextExpiration(baseDate);
  const nuevoSaldo = saldoPendiente !== undefined ? Math.max(0, saldoPendiente) : 0;
  const nuevoEstadoPago: PaymentStatus = nuevoSaldo > 0 ? 'parcial' : 'pagado';

  const updates: Partial<Member> = {
    fecha_vencimiento: newExpiration,
    estado_membresia: 'activo',
    estado_pago: nuevoEstadoPago,
    saldo_pendiente: nuevoSaldo,
    ultimo_pago_fecha: renewalDate,
  };

  if (disciplina) {
    updates.disciplina = disciplina;
  }
  if (monto !== undefined) {
    updates.monto_mensual = monto;
  }

  const updated = await updateMember(memberId, updates, { skipPaymentLog: true });

  await logPayment({
    member_id: memberId,
    fecha: renewalDate,
    monto: monto !== undefined ? monto : member.monto_mensual || 0,
    metodo: metodo as PaymentMethod,
    periodo_inicio: baseDate,
    periodo_fin: newExpiration,
    detalles: detalles && detalles.length > 0 ? detalles : undefined,
    notas: notas || (nuevoSaldo > 0 ? `Pago parcial (Saldo pendiente: $${nuevoSaldo})` : undefined),
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Accesos
// ---------------------------------------------------------------------------
const ACCESS_SELECT = '*, miembros(full_name, dni)';

export async function logAccess(log: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('accesos')
    .insert([
      {
        local_id: localId,
        miembro_id: log.member_id,
        status: log.autorizado ? 'autorizado' : 'denegado',
        notes: log.motivo || null,
        disciplina: log.disciplina || null,
      },
    ])
    .select(ACCESS_SELECT)
    .single();

  if (error) throw error;
  return toAccessLog(data as AccessRow);
}

export async function fetchAccessLogs(limit = 100): Promise<AccessLog[]> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('accesos')
    .select(ACCESS_SELECT)
    .eq('local_id', localId)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as AccessRow[]).map(toAccessLog);
}

/** Últimos ingresos de un socio en un local (portal del socio). */
export async function fetchMemberAccessLogs(memberId: string, localId: string, limit = 5): Promise<AccessLog[]> {
  const { data, error } = await db()
    .from('accesos')
    .select('*')
    .eq('local_id', localId)
    .eq('miembro_id', memberId)
    .order('scanned_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('No se pudieron cargar los ingresos', error);
    return [];
  }
  return ((data || []) as AccessRow[]).map(toAccessLog);
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------
export async function logPayment(payment: Omit<PaymentLog, 'id'>): Promise<PaymentLog> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('pagos')
    .insert([
      {
        local_id: localId,
        miembro_id: payment.member_id,
        amount: Number(payment.monto),
        payment_method: payment.metodo,
        // Mediodía en la hora del navegador: evita que la fecha cambie de día por la zona horaria
        payment_date: payment.fecha ? new Date(`${payment.fecha}T12:00:00`).toISOString() : new Date().toISOString(),
        period_start: payment.periodo_inicio || null,
        expiration_date: payment.periodo_fin || null,
        details: payment.detalles && payment.detalles.length > 0 ? payment.detalles : [],
        notes: payment.notas || null,
      },
    ])
    .select('*')
    .single();

  if (error) throw error;
  return toPaymentLog(data as PaymentRow);
}

export async function fetchPaymentLogs(limit = 100): Promise<PaymentLog[]> {
  const localId = requireLocal();
  const { data, error } = await db()
    .from('pagos')
    .select('*')
    .eq('local_id', localId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as PaymentRow[]).map(toPaymentLog);
}
