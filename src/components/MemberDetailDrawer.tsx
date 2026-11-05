import React, { useEffect, useMemo, useState } from 'react';
import { Member, AccessLog, PaymentLog } from '../types';
import {
  getMembershipTone,
  TONE_CLASSES,
  formatDate,
  formatShortDate,
  formatMoney,
} from '../lib/status';
import { buildWhatsAppLink } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';
import { setMemberAccess, resetMemberPassword, authErrorMessage } from '../lib/authService';
import { Drawer, MemberAvatar, StatusBadge, Button, Alert } from './ui';
import {
  Banknote,
  Pencil,
  QrCode,
  MessageCircle,
  ScanLine,
  KeyRound,
} from 'lucide-react';

export interface MemberDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  accessLogs: AccessLog[];
  paymentLogs: PaymentLog[];
  onCobrar: (member: Member) => void;
  onEditar: (member: Member) => void;
  onVerCarnet: (member: Member) => void;
}

export const MemberDetailDrawer: React.FC<MemberDetailDrawerProps> = ({
  isOpen,
  onClose,
  member,
  accessLogs,
  paymentLogs,
  onCobrar,
  onEditar,
  onVerCarnet,
}) => {
  // Acceso a la app: solo carnet / habilitado / básico / verificado
  const [acceso, setAcceso] = useState<{ appAccess: boolean; hasAccount: boolean; verified: boolean } | null>(null);
  const [accesoBusy, setAccesoBusy] = useState(false);
  const [accesoMsg, setAccesoMsg] = useState<string | null>(null);
  const [accesoError, setAccesoError] = useState<string | null>(null);

  const memberId = member?.id;
  const membershipId = member?.membership_id;
  useEffect(() => {
    setAcceso(null);
    setAccesoMsg(null);
    setAccesoError(null);
    if (!isOpen || !memberId || !membershipId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('local_miembros').select('acceso_app').eq('id', membershipId).maybeSingle(),
      supabase.from('miembros').select('profile_id, is_claimed').eq('id', memberId).maybeSingle(),
    ]).then(([lm, person]) => {
      if (cancelled || lm.error || person.error) return;
      setAcceso({
        appAccess: Boolean(lm.data?.acceso_app),
        hasAccount: Boolean(person.data?.profile_id),
        verified: Boolean(person.data?.is_claimed),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, memberId, membershipId]);

  const toggleAcceso = async () => {
    if (!member || !acceso) return;
    setAccesoBusy(true);
    setAccesoMsg(null);
    setAccesoError(null);
    try {
      await setMemberAccess(member.id, !acceso.appAccess);
      setAcceso({ ...acceso, appAccess: !acceso.appAccess });
    } catch (err) {
      setAccesoError(authErrorMessage(err, 'No pudimos cambiar el acceso.'));
    } finally {
      setAccesoBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!member) return;
    setAccesoBusy(true);
    setAccesoMsg(null);
    setAccesoError(null);
    try {
      const result = await resetMemberPassword(member.id);
      if (result === 'REINICIADO') {
        setAcceso((prev) => (prev ? { ...prev, appAccess: true, hasAccount: false } : prev));
        setAccesoMsg('Listo. En su próximo ingreso con DNI va a elegir una contraseña nueva.');
      } else {
        setAccesoMsg('Todavía no tiene contraseña: la elige en su primer ingreso.');
      }
    } catch (err) {
      setAccesoError(authErrorMessage(err, 'No pudimos restablecer la contraseña.'));
    } finally {
      setAccesoBusy(false);
    }
  };

  const membership = useMemo(() => {
    if (!member) return null;
    return getMembershipTone(member);
  }, [member]);

  const tone = membership ? TONE_CLASSES[membership.tone] : null;

  // Status text for the membership block
  const statusText = useMemo(() => {
    if (!membership) return '';
    if (membership.status === 'vencido') {
      return membership.days < 0 ? 'Vencido' : 'Impago';
    }
    if (membership.status === 'por_vencer') {
      if (membership.days === 0) return 'Vence hoy';
      if (membership.days === 1) return 'Vence mañana';
      return 'Vence en 2 d';
    }
    return 'Al día';
  }, [membership]);

  // Payment status badge
  const paymentBadge = useMemo(() => {
    if (!member) return { tone: 'ok' as const, label: 'Pagado' };

    let paymentTone: 'ok' | 'warn' | 'danger' = 'ok';
    let paymentLabel = 'Pagado';

    if (member.estado_pago === 'parcial' && (member.saldo_pendiente ?? 0) > 0) {
      paymentTone = 'warn';
      paymentLabel = `Debe $${(member.saldo_pendiente ?? 0).toLocaleString('es-AR')}`;
    } else if (
      member.estado_pago === 'pendiente' ||
      member.estado_pago === 'saldo' ||
      member.estado_pago === 'vencido'
    ) {
      paymentTone = 'danger';
      paymentLabel = 'Impago';
    } else if (member.estado_pago === 'parcial') {
      paymentTone = 'warn';
      paymentLabel = 'Parcial';
    }

    return { tone: paymentTone, label: paymentLabel };
  }, [member]);

  // Recent activity: combined accesses and payments for this member
  const recentActivity = useMemo(() => {
    if (!member) return [];

    const memberAccesses = accessLogs
      .filter((l) => l.member_id === member.id || l.dni === member.dni)
      .map((l) => ({
        id: `access-${l.id}`,
        type: 'access' as const,
        date: new Date(l.timestamp),
        dateIso: l.timestamp,
        title: l.autorizado ? 'Ingreso autorizado' : 'Ingreso denegado',
        subtitle: l.motivo || l.disciplina,
        tone: (l.autorizado ? 'ok' : 'danger') as 'ok' | 'danger',
        badge: l.autorizado ? 'Autorizado' : 'Denegado',
      }));

    const memberPayments = paymentLogs
      .filter((p) => p.member_id === member.id)
      .map((p) => ({
        id: `payment-${p.id}`,
        type: 'payment' as const,
        date: new Date(p.fecha),
        dateIso: p.fecha,
        title: `Pago registrado ${p.metodo ? `(${p.metodo})` : ''}`.trim(),
        subtitle:
          p.notas ||
          (p.detalles && p.detalles.length > 0
            ? p.detalles.map((d) => `${d.metodo}: ${formatMoney(d.monto)}`).join(', ')
            : 'Cobro de cuota'),
        tone: 'ok' as const,
        badge: formatMoney(p.monto || 0),
      }));

    const combined = [...memberAccesses, ...memberPayments];
    combined.sort((a, b) => {
      const timeA = isNaN(a.date.getTime()) ? 0 : a.date.getTime();
      const timeB = isNaN(b.date.getTime()) ? 0 : b.date.getTime();
      return timeB - timeA;
    });

    return combined;
  }, [member, accessLogs, paymentLogs]);

  if (!member || !membership || !tone) return null;

  const absDays = Math.abs(membership.days);
  const daysSuffix = absDays === 1 ? 'día' : 'días';
  const daysContext = membership.days < 0 ? 'de atraso' : 'restantes';

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Ficha del socio"
      subtitle={`${member.nombre} ${member.apellido}`}
    >
      <div className="space-y-5">
        {/* Header: Avatar 60px, nombre, "Disciplina · DNI" */}
        <div className="flex items-center gap-3.5">
          <MemberAvatar
            src={member.foto_url}
            name={`${member.nombre} ${member.apellido}`}
            className="w-[60px] h-[60px] text-lg shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-text-primary leading-tight truncate">
              {member.nombre} {member.apellido}
            </h3>
            <p className="text-xs text-text-muted truncate mt-1 capitalize">
              {member.disciplina} ·{' '}
              <span className="font-mono text-text-secondary">{member.dni}</span>
            </p>
          </div>
        </div>

        {/* Bloque de estado con bg del tono suave: statusText y días grandes en el color del tono */}
        <div
          className={`p-4 rounded-2xl border ${tone.bg} ${tone.border} flex items-center justify-between gap-3 select-none`}
        >
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-[0.12em] font-extrabold text-text-muted block">
              Estado
            </span>
            <div className={`text-lg font-bold ${tone.text} mt-0.5 leading-snug truncate`}>
              {statusText}
            </div>
            {membership.debt && (
              <div className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-status-warn">
                Debe {formatMoney(membership.debt)}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <span
              className={`text-[32px] sm:text-[36px] font-bold ${tone.text} leading-none block`}
            >
              {absDays}
            </span>
            <span className="text-[11px] font-semibold text-text-muted mt-1 block">
              {daysSuffix} {daysContext}
            </span>
          </div>
        </div>

        {/* Acciones: Button primary "Cobrar", secondary "Editar", iconOnly Ver carnet y WhatsApp */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={Banknote}
            onClick={() => onCobrar(member)}
            className="flex-1"
          >
            Cobrar
          </Button>

          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => onEditar(member)}
          >
            Editar
          </Button>

          <Button
            variant="secondary"
            iconOnly
            icon={QrCode}
            aria-label="Ver carnet"
            title="Ver carnet"
            onClick={() => onVerCarnet(member)}
          />

          <Button
            variant="secondary"
            iconOnly
            icon={MessageCircle}
            aria-label="WhatsApp"
            title={member.telefono ? 'Enviar WhatsApp' : 'Sin teléfono registrado'}
            disabled={!member.telefono}
            onClick={() => {
              if (!member.telefono) return;
              const link = buildWhatsAppLink(
                member.nombre,
                member.disciplina,
                member.fecha_vencimiento,
                member.telefono,
                membership.days
              );
              window.open(link, '_blank', 'noopener,noreferrer');
            }}
          />
        </div>

        {/* Acceso a la app */}
        {acceso && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
              Acceso a la app
            </h4>
            <div className="bg-surface-100 rounded-xl border border-border-subtle p-3.5 space-y-3">
              {accesoError && <Alert>{accesoError}</Alert>}
              {accesoMsg && <p className="text-xs text-status-ok">{accesoMsg}</p>}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-text-muted">Estado</span>
                <span className="text-text-primary font-semibold">
                  {acceso.verified
                    ? 'Verificado (entra con su email)'
                    : acceso.hasAccount
                      ? 'Básico (entra con DNI)'
                      : acceso.appAccess
                        ? 'Habilitado, sin contraseña todavía'
                        : 'Solo carnet'}
                </span>
              </div>
              {!acceso.verified && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="md" loading={accesoBusy} onClick={toggleAcceso}>
                    {acceso.appAccess ? 'Quitar acceso' : 'Permitir acceso'}
                  </Button>
                  {acceso.hasAccount && (
                    <Button variant="secondary" size="md" icon={KeyRound} loading={accesoBusy} onClick={resetPassword}>
                      Restablecer contraseña
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista de datos (Teléfono, Alta, Vence, Cuota, Pago) en filas label/valor */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            Datos del socio
          </h4>
          <div className="bg-surface-100 rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
            <div className="flex items-center justify-between py-2.5 px-3.5 text-xs">
              <span className="text-text-muted">Teléfono</span>
              <span className="font-mono text-text-primary">
                {member.telefono || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3.5 text-xs">
              <span className="text-text-muted">Alta</span>
              <span className="text-text-primary">
                {formatDate(member.fecha_ingreso)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3.5 text-xs">
              <span className="text-text-muted">Vence</span>
              <span className="text-text-primary">
                {formatDate(member.fecha_vencimiento)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3.5 text-xs">
              <span className="text-text-muted">Cuota</span>
              <span className="font-semibold text-text-primary">
                {formatMoney(member.monto_mensual || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 px-3.5 text-xs">
              <span className="text-text-muted">Pago</span>
              <StatusBadge tone={paymentBadge.tone}>
                {paymentBadge.label}
              </StatusBadge>
            </div>
          </div>
        </div>

        {/* "Actividad reciente" con accesos y pagos del socio, o "Sin actividad registrada." */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            Actividad reciente
          </h4>
          {recentActivity.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-muted bg-surface-100 rounded-xl border border-border-subtle">
              Sin actividad registrada.
            </div>
          ) : (
            <div className="bg-surface-100 rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              {recentActivity.slice(0, 8).map((act) => (
                <div
                  key={act.id}
                  className="px-3.5 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {act.type === 'access' ? (
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          act.tone === 'ok'
                            ? 'bg-status-ok-soft text-status-ok'
                            : 'bg-status-danger-soft text-status-danger'
                        }`}
                      >
                        <ScanLine size={14} strokeWidth={2} />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-status-ok-soft text-status-ok flex items-center justify-center shrink-0">
                        <Banknote size={14} strokeWidth={2} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary truncate">
                        {act.title}
                      </p>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        {act.subtitle ? `${act.subtitle} · ` : ''}
                        {formatShortDate(act.dateIso)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      act.type === 'payment'
                        ? 'text-status-ok'
                        : act.tone === 'danger'
                        ? 'text-status-danger'
                        : 'text-text-secondary'
                    }`}
                  >
                    {act.badge}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};

