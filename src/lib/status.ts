import { Member } from '../types';
import { getDaysRemaining } from './dateUtils';

export type MembershipTone = 'ok' | 'warn' | 'danger';

export interface MembershipToneResult {
  status: 'activo' | 'por_vencer' | 'vencido';
  tone: MembershipTone;
  days: number;
  label: 'Al día' | 'Por vencer' | 'Vencido';
  shortLabel: string;
  debt: number | null;
}

export const TONE_CLASSES: Record<
  MembershipTone,
  { text: string; bg: string; border: string; solid: string; borderSolid: string }
> = {
  ok: {
    text: 'text-status-ok',
    bg: 'bg-status-ok-soft',
    border: 'border-status-ok-border',
    solid: 'bg-status-ok',
    borderSolid: 'border-status-ok',
  },
  warn: {
    text: 'text-status-warn',
    bg: 'bg-status-warn-soft',
    border: 'border-status-warn-border',
    solid: 'bg-status-warn',
    borderSolid: 'border-status-warn',
  },
  danger: {
    text: 'text-status-danger',
    bg: 'bg-status-danger-soft',
    border: 'border-status-danger-border',
    solid: 'bg-status-danger',
    borderSolid: 'border-status-danger',
  },
};

/**
 * Single status helper applying DESIGN.md rules in strict order:
 * 1. estado_pago is pendiente, saldo or vencido, or days < 0 → vencido → "Vencido" (days < 0) or "Impago" → tone danger
 * 2. days <= 2 → por_vencer → "Vence hoy" / "Vence mañana" / "Vence en 2 d" → tone warn
 * 3. resto → activo → "Al día" (in lists: "N días") → tone ok
 * Partial payment: keeps tone, exposes debt amount if saldo_pendiente > 0.
 */
export function getMembershipTone(member: Member): MembershipToneResult {
  const days = getDaysRemaining(member.fecha_vencimiento);
  const debt =
    member.estado_pago === 'parcial' && (member.saldo_pendiente ?? 0) > 0
      ? (member.saldo_pendiente ?? null)
      : null;

  // 1. Unpaid or expired
  const isUnpaidOrExpired =
    member.estado_pago === 'pendiente' ||
    member.estado_pago === 'saldo' ||
    member.estado_pago === 'vencido' ||
    days < 0;

  if (isUnpaidOrExpired) {
    return {
      status: 'vencido',
      tone: 'danger',
      days,
      label: 'Vencido',
      shortLabel: days < 0 ? `Vencido hace ${Math.abs(days)} d` : 'Impago',
      debt,
    };
  }

  // 2. Expiring soon (days <= 2)
  if (days <= 2) {
    let shortLabel = 'Vence en 2 d';
    if (days === 0) {
      shortLabel = 'Vence hoy';
    } else if (days === 1) {
      shortLabel = 'Vence mañana';
    }

    return {
      status: 'por_vencer',
      tone: 'warn',
      days,
      label: 'Por vencer',
      shortLabel,
      debt,
    };
  }

  // 3. Active / on track
  return {
    status: 'activo',
    tone: 'ok',
    days,
    label: 'Al día',
    shortLabel: `${days} días`,
    debt,
  };
}

/**
 * Format currency with Argentine locale and $ prefix (e.g. $15.000)
 */
export function formatMoney(n: number): string {
  return `$${n.toLocaleString('es-AR')}`;
}

/**
 * Format ISO date string to dd/mm/aaaa
 */
export function formatDate(iso: string): string {
  if (!iso) return '';
  const datePart = iso.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dd}/${mm}/${y}`;
}

/**
 * Format ISO date string to short format (e.g. '23 nov')
 */
export function formatShortDate(iso: string): string {
  if (!iso) return '';
  const datePart = iso.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
}

