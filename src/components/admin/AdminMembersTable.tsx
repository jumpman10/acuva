import React, { useState } from 'react';
import { Member } from '../../types';
import { getCalculatedStatus, formatDisplayDate, buildWhatsAppLink } from '../../lib/dateUtils';
import { getMemberInitials } from './AdminMemberCard';
import { CreditCard, QrCode, MessageCircle, Edit, Trash2 } from 'lucide-react';

export interface AdminMembersTableProps {
  members: Member[];
  onRenewClick: (member: Member) => void;
  onOpenCardModal: (member: Member) => void;
  onOpenEditMember: (member: Member) => void;
  onDeleteClick: (member: Member) => void;
}

export const AdminMembersTable: React.FC<AdminMembersTableProps> = ({
  members,
  onRenewClick,
  onOpenCardModal,
  onOpenEditMember,
  onDeleteClick,
}) => {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  return (
    <div className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0a101d] text-slate-400 uppercase tracking-wider text-[11px] font-mono border-b border-slate-800 select-none">
            <tr>
              <th className="py-3.5 pl-4 pr-3">Socio</th>
              <th className="py-3.5 px-3">DNI</th>
              <th className="py-3.5 px-3">Disciplina</th>
              <th className="py-3.5 px-3">Ingreso</th>
              <th className="py-3.5 px-3">Vencimiento</th>
              <th className="py-3.5 px-3">Estado</th>
              <th className="py-3.5 px-3">Pago</th>
              <th className="py-3.5 pl-3 pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {members.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No se encontraron socios con los filtros actuales.
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const status = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);
                const days = status.daysRemaining;
                const initials = getMemberInitials(member.nombre, member.apellido);

                // Status pill
                let statusBadge = (
                  <span className="bg-[#0f2824] border border-[#34d399]/30 text-[#34d399] font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                    <span>{days === 0 ? 'Vence hoy' : `${days} días`}</span>
                  </span>
                );

                if (days >= 0 && days <= 2) {
                  statusBadge = (
                    <span className="bg-[#2b2210] border border-[#fbbf24]/30 text-[#fbbf24] font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
                      <span>{days === 0 ? 'Vence hoy' : `${days} días`}</span>
                    </span>
                  );
                } else if (days < 0 || member.estado_pago === 'vencido' || member.estado_pago === 'pendiente' || member.estado_pago === 'saldo') {
                  statusBadge = (
                    <span className="bg-[#2a1317] border border-[#f87171]/30 text-[#f87171] font-semibold text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
                      <span> {Math.abs(days)}d vencido</span>
                    </span>
                  );
                }

                // Payment badge
                let paymentBadge = (
                  <span className="bg-emerald-950/70 border border-emerald-500/30 text-[#34d399] font-bold text-xs px-2.5 py-1 rounded-md inline-block whitespace-nowrap">
                    Pagado
                  </span>
                );

                if (member.estado_pago === 'parcial') {
                  paymentBadge = (
                    <span className="bg-amber-950/70 border border-amber-500/30 text-[#fbbf24] font-bold text-xs px-2.5 py-1 rounded-md inline-block whitespace-nowrap">
                      Parcial
                    </span>
                  );
                } else if (member.estado_pago === 'pendiente' || member.estado_pago === 'saldo' || member.estado_pago === 'vencido') {
                  paymentBadge = (
                    <span className="bg-rose-950/70 border border-rose-500/30 text-[#f87171] font-bold text-xs px-2.5 py-1 rounded-md inline-block whitespace-nowrap">
                      Impago
                    </span>
                  );
                }

                return (
                  <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Socio */}
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#132d2c] border border-[#34d399]/30 text-[#34d399] font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                          {member.foto_url && !brokenImages[member.id] ? (
                            <img
                              src={member.foto_url}
                              alt={`${member.nombre} ${member.apellido}`}
                              className="w-full h-full object-cover"
                              onError={() => setBrokenImages((prev) => ({ ...prev, [member.id]: true }))}
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate">
                            {member.nombre} {member.apellido}
                          </p>
                          <p className="text-slate-400 text-[11px] font-mono mt-0.5 truncate">
                            {member.telefono}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* DNI */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-white font-mono text-xs">{member.dni}</p>
                      {member.fecha_nacimiento && (
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Nac. {formatDisplayDate(member.fecha_nacimiento)}
                        </p>
                      )}
                    </td>

                    {/* Disciplina */}
                    <td className="py-3 px-3">
                      <span className="bg-[#090e17] border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg capitalize inline-block">
                        {member.disciplina}
                      </span>
                    </td>

                    {/* Ingreso */}
                    <td className="py-3 px-3 text-slate-300 font-mono text-xs">
                      {formatDisplayDate(member.fecha_ingreso)}
                    </td>

                    {/* Vencimiento */}
                    <td className="py-3 px-3 font-bold font-mono text-xs text-white">
                      {formatDisplayDate(member.fecha_vencimiento)}
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-3">{statusBadge}</td>

                    {/* Pago */}
                    <td className="py-3 px-3">{paymentBadge}</td>

                    {/* Acciones */}
                    <td className="py-3 pl-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenCardModal(member)}
                          title="Ver Carnet QR"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        <a
                          href={buildWhatsAppLink(
                            member.nombre,
                            member.disciplina,
                            member.fecha_vencimiento,
                            member.telefono,
                            days
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar WhatsApp"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => onOpenEditMember(member)}
                          title="Editar socio"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDeleteClick(member)}
                          title="Eliminar socio"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Prominent Cobrar button */}
                        <button
                          onClick={() => onRenewClick(member)}
                          className="ml-1.5 px-3 py-1.5 bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 text-[#080c14] font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <CreditCard className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Cobrar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
