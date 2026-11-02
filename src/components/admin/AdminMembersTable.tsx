import React from 'react';
import { Member } from '../../types';
import { getMembershipTone, formatDate } from '../../lib/status';
import { buildWhatsAppLink } from '../../lib/dateUtils';
import { Card, MemberAvatar, StatusBadge, Button } from '../ui';
import { Banknote, QrCode, MessageCircle } from 'lucide-react';

export interface AdminMembersTableProps {
  members: Member[];
  onRenewClick: (member: Member) => void;
  onOpenCardModal: (member: Member) => void;
  onOpenEditMember: (member: Member) => void;
  onSelectMember?: (member: Member) => void;
  onDeleteClick?: (member: Member) => void;
}

export const AdminMembersTable: React.FC<AdminMembersTableProps> = ({
  members,
  onRenewClick,
  onOpenCardModal,
  onOpenEditMember,
  onSelectMember,
}) => {
  return (
    <Card className="p-0 overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-100 text-text-muted text-xs font-bold">
            <tr>
              <th className="py-3.5 pl-4 pr-3">Socio</th>
              <th className="py-3.5 px-3">Disciplina</th>
              <th className="py-3.5 px-3">Vencimiento</th>
              <th className="py-3.5 px-3">Estado</th>
              <th className="py-3.5 px-3">Pago</th>
              <th className="py-3.5 pl-3 pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted text-sm">
                  No hay socios con estos filtros.
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const membership = getMembershipTone(member);

                // Pago badge logic: (Pagado ok / "Debe $X" warn / Impago danger)
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

                return (
                  <tr
                    key={member.id}
                    onClick={() => (onSelectMember ? onSelectMember(member) : onOpenEditMember(member))}
                    className="border-t border-border-subtle hover:bg-surface-200 transition-colors cursor-pointer"
                  >
                    {/* Socio: MemberAvatar 40px + nombre font-bold + DNI mono text-text-muted */}
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          src={member.foto_url}
                          name={`${member.nombre} ${member.apellido}`}
                          className="w-10 h-10"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary text-sm truncate">
                            {member.nombre} {member.apellido}
                          </p>
                          <p className="font-mono text-xs text-text-muted truncate mt-0.5">
                            {member.dni}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Disciplina */}
                    <td className="py-3 px-3">
                      <span className="text-xs text-text-secondary capitalize">
                        {member.disciplina}
                      </span>
                    </td>

                    {/* Vencimiento: formatDate */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-text-primary">
                        {formatDate(member.fecha_vencimiento)}
                      </span>
                    </td>

                    {/* Estado: StatusBadge con tone y shortLabel */}
                    <td className="py-3 px-3">
                      <StatusBadge tone={membership.tone}>
                        {membership.shortLabel}
                      </StatusBadge>
                    </td>

                    {/* Pago: StatusBadge (Pagado ok / "Debe $X" warn / Impago danger) */}
                    <td className="py-3 px-3">
                      <StatusBadge tone={paymentTone}>
                        {paymentLabel}
                      </StatusBadge>
                    </td>

                    {/* Acciones: iconOnly ghost Cobrar (Banknote), Ver carnet (QrCode), WhatsApp (MessageCircle) */}
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          iconOnly
                          icon={Banknote}
                          aria-label="Cobrar"
                          title="Cobrar"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRenewClick(member);
                          }}
                        />

                        <Button
                          variant="ghost"
                          iconOnly
                          icon={QrCode}
                          aria-label="Ver carnet"
                          title="Ver carnet"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCardModal(member);
                          }}
                        />

                        <a
                          href={buildWhatsAppLink(
                            member.nombre,
                            member.disciplina,
                            member.fecha_vencimiento,
                            member.telefono,
                            membership.days
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          aria-label="WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-9 h-9 min-w-[36px] min-h-[36px] rounded-[10px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
                        >
                          <MessageCircle size={17} strokeWidth={2} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
