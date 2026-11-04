export type MembershipStatus = 'activo' | 'por_vencer' | 'vencido' | 'inactivo';
export type PaymentStatus = 'pagado' | 'pendiente' | 'vencido' | 'parcial' | 'saldo';

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de débito'
  | 'Tarjeta de crédito'
  | 'Pago con QR'
  | 'Mixto';

export interface PaymentMethodDetail {
  metodo: 'Efectivo' | 'Transferencia' | 'Tarjeta de débito' | 'Tarjeta de crédito' | 'Pago con QR';
  monto: number;
}

export interface DisciplineItem {
  id: string;
  nombre: string;
  precio: number;
}

export type Discipline = string;

export type UserRole = 'local' | 'miembro';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  dni?: string;
}

export interface Local {
  id: string;
  profile_id: string;
  email: string;
  owner_name: string;
  name: string;
  address?: string;
  phone?: string;
  max_members: number;
  plan: string;
  linked_members_count: number;
  avatar_url?: string;
  /** Segmento de URL público del local: acuva.com.ar/{slug} */
  slug?: string;
}

/** Datos públicos de un local que devuelve get_local_by_slug (sin sesión). */
export interface PublicLocal {
  id: string;
  slug: string;
  name: string;
  avatar_url?: string | null;
  is_full: boolean;
}

/**
 * Socio dentro de un local: une la persona (tabla `miembros`) con su
 * membresía en ese local (tabla `local_miembros`). `id` es el de la persona.
 */
export interface Member {
  id: string;
  /** id de la fila en local_miembros */
  membership_id?: string;
  local_id?: string;
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string; // YYYY-MM-DD
  foto_url: string;
  disciplina: Discipline;
  telefono: string;
  fecha_ingreso: string; // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  estado_membresia: MembershipStatus;
  estado_pago: PaymentStatus;
  monto_mensual: number;
  saldo_pendiente?: number;
  metodo_pago?: PaymentMethod;
  ultimo_pago_fecha?: string;
  creado_en: string;
  notas?: string;
  codigo_qr: string; // token for verification

  // Auth & multi-local profile fields
  profile_id?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  is_claimed?: boolean;
}

export type Miembro = Member;

/** Fila de `miembros`: la persona, sin datos de ningún local. */
export interface MemberProfile {
  id: string;
  profile_id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  dni?: string | null;
  is_claimed?: boolean | null;
  fecha_nacimiento?: string | null;
  created_at?: string;
}

export interface AccessLog {
  id: string;
  member_id: string;
  dni: string;
  member_name: string;
  disciplina: Discipline;
  timestamp: string;
  autorizado: boolean;
  motivo?: string;
}

export interface PaymentLog {
  id: string;
  member_id: string;
  fecha: string;
  monto: number;
  metodo: PaymentMethod | 'Tarjeta' | string;
  periodo_inicio: string;
  periodo_fin: string;
  detalles?: PaymentMethodDetail[];
  notas?: string;
}

export interface RenewMemberOptions {
  monto?: number;
  metodo?: PaymentMethod | string;
  detalles?: PaymentMethodDetail[];
  disciplina?: string;
  fechaRenovacion?: string;
  fechaVencimiento?: string;
  saldoPendiente?: number;
  esPagoSaldo?: boolean;
  notas?: string;
}
