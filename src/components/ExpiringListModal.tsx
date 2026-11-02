import React, { useMemo } from 'react';
import { Member } from '../types';
import { getMembershipTone } from '../lib/status';
import { buildWhatsAppLink } from '../lib/dateUtils';
import { Drawer, Button, MemberAvatar, StatusBadge } from './ui';
import { MessageCircle } from 'lucide-react';

export interface ExpiringListModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
}

export const ExpiringListModal: React.FC<ExpiringListModalProps> = ({
  isOpen,
  onClose,
  members,
}) => {
  const expiringSoon = useMemo(() => {
    return members
      .filter((m) => getMembershipTone(m).status === 'por_vencer')
      .sort((a, b) => getMembershipTone(a).days - getMembershipTone(b).days);
  }, [members]);

  const expiredOrUnpaid = useMemo(() => {
    return members
      .filter((m) => getMembershipTone(m).status === 'vencido')
      .sort((a, b) => getMembershipTone(a).days - getMembershipTone(b).days);
  }, [members]);

  const handleAvisar = (member: Member) => {
    const tone = getMembershipTone(member);
    const link = buildWhatsAppLink(
      member.nombre,
      member.disciplina,
      member.fecha_vencimiento,
      member.telefono,
      tone.days
    );
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const renderMemberRow = (member: Member) => {
    const tone = getMembershipTone(member);
    return (
      <div
        key={member.id}
        className="px-3.5 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-200 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <MemberAvatar
            src={member.foto_url}
            name={`${member.nombre} ${member.apellido}`}
            className="w-10 h-10 shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-text-primary text-sm truncate">
              {member.nombre} {member.apellido}
            </p>
            <p className="text-[11px] text-text-muted truncate mt-0.5 capitalize">
              {member.disciplina} · <span className="font-mono">{member.telefono || 'Sin tel.'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <StatusBadge tone={tone.tone}>
            {tone.shortLabel}
          </StatusBadge>

          <Button
            variant="secondary"
            size="md"
            icon={MessageCircle}
            disabled={!member.telefono}
            onClick={() => handleAvisar(member)}
            title={member.telefono ? 'Avisar por WhatsApp' : 'Sin teléfono'}
          >
            Avisar
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      title="Recordatorios"
      subtitle="Avisá por WhatsApp a quienes vencen"
    >
      <div className="space-y-6">
        {/* Grupo 1: Vencen en ≤ 2 días (warn) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-warn" />
              <h3 className="text-sm font-bold text-text-primary">
                Vencen en ≤ 2 días
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-status-warn">
              {expiringSoon.length}
            </span>
          </div>

          {expiringSoon.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted bg-surface-100 rounded-xl border border-border-subtle">
              No hay socios que venzan en los próximos 2 días.
            </div>
          ) : (
            <div className="bg-surface-100 rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              {expiringSoon.map(renderMemberRow)}
            </div>
          )}
        </div>

        {/* Grupo 2: Vencidos o impagos (danger) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-danger" />
              <h3 className="text-sm font-bold text-text-primary">
                Vencidos o impagos
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-status-danger">
              {expiredOrUnpaid.length}
            </span>
          </div>

          {expiredOrUnpaid.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted bg-surface-100 rounded-xl border border-border-subtle">
              No hay socios vencidos ni con pagos pendientes.
            </div>
          ) : (
            <div className="bg-surface-100 rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
              {expiredOrUnpaid.map(renderMemberRow)}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
