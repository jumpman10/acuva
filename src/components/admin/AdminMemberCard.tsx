import React from 'react';
import { Member } from '../../types';
import { getMembershipTone, formatShortDate } from '../../lib/status';
import { Card, MemberAvatar, StatusBadge, Button } from '../ui';
import { Banknote, QrCode } from 'lucide-react';

export interface AdminMemberCardProps {
  member: Member;
  onRenewClick: (member: Member) => void;
  onOpenCardModal: (member: Member) => void;
  onOpenEditMember: (member: Member) => void;
  onSelectMember?: (member: Member) => void;
  onDeleteClick?: (member: Member) => void;
}

export const AdminMemberCard: React.FC<AdminMemberCardProps> = ({
  member,
  onRenewClick,
  onOpenCardModal,
  onOpenEditMember,
  onSelectMember,
}) => {
  const membership = getMembershipTone(member);

  return (
    <Card
      onClick={() => (onSelectMember ? onSelectMember(member) : onOpenEditMember(member))}
      className="p-3.5 space-y-3 cursor-pointer hover:border-border-default transition-colors select-none"
    >
      {/* Fila principal: Avatar 46px + Nombre + "Disciplina · vence 23 nov" + StatusBadge a la derecha */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <MemberAvatar
            src={member.foto_url}
            name={`${member.nombre} ${member.apellido}`}
            className="w-[46px] h-[46px]"
          />
          <div className="min-w-0">
            <h4 className="font-bold text-text-primary text-[15px] leading-tight truncate">
              {member.nombre} {member.apellido}
            </h4>
            <p className="text-[13px] text-text-muted truncate mt-0.5 capitalize">
              {member.disciplina} · vence {formatShortDate(member.fecha_vencimiento)}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <StatusBadge tone={membership.tone}>
            {membership.shortLabel}
          </StatusBadge>
        </div>
      </div>

      {/* Acciones debajo: Button secondary "Cobrar" y iconOnly Ver carnet */}
      <div
        className="flex items-center gap-2 pt-2 border-t border-border-subtle"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="secondary"
          icon={Banknote}
          onClick={(e) => {
            e.stopPropagation();
            onRenewClick(member);
          }}
          className="flex-1"
        >
          Cobrar
        </Button>

        <Button
          variant="secondary"
          iconOnly
          icon={QrCode}
          aria-label="Ver carnet"
          title="Ver carnet"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCardModal(member);
          }}
        />
      </div>
    </Card>
  );
};
