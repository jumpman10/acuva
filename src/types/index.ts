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
  members_id: string[];
}

export interface Member {
  id: string;
  profile_id: string;
  dni: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  is_claimed: boolean;
  locals_id: string[];
  status: 'active' | 'expiring' | 'expired' | 'unpaid';
}

export type Miembro = Member;

export interface LocalMiembro {
  id: string;
  local_id: string;
  miembro_id: string;
  status: string;
  joined_at: string;
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

export interface CurrentUser {
  role: UserRole;
  member?: Member;
  email?: string;
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
