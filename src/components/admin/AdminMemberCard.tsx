import React, { useState } from 'react';
import { Member } from '../../types';
import { getCalculatedStatus, formatDisplayDate, buildWhatsAppLink } from '../../lib/dateUtils';
import { CreditCard, QrCode, MessageCircle, Edit, Trash2 } from 'lucide-react';

export interface AdminMemberCardProps {
  member: Member;
  onRenewClick: (member: Member) => void;
  onOpenCardModal: (member: Member) => void;
  onOpenEditMember: (member: Member) => void;
  onDeleteClick: (member: Member) => void;
}

export const getMemberInitials = (nombre: string, apellido: string): string => {
  const n = (nombre || '').trim();
  const a = (apellido || '').trim();
  if (n && a) {
    return (n[0] + a[0]).toUpperCase();
  }
  if (n) {
    return n.slice(0, 2).toUpperCase();
  }
  return 'SO';
};

export const AdminMemberCard: React.FC<AdminMemberCardProps> = ({
  member,
  onRenewClick,
  onOpenCardModal,
  onOpenEditMember,
  onDeleteClick,
}) => {
  const [imgError, setImgError] = useState(false);
  const status = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);
  const days = status.daysRemaining;

  // Status badge styling
  let statusBadge = (
    <div className="bg-[#0f2824] border border-[#34d399]/40 text-[#34d399] font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
      <span>• {days === 0 ? 'Vence hoy' : `${days} días`}</span>
    </div>
  );

  if (days >= 0 && days <= 2) {
    statusBadge = (
      <div className="bg-[#2b2210] border border-[#fbbf24]/40 text-[#fbbf24] font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
        <span>• {days === 0 ? 'Vence hoy' : `${days} días`}</span>
      </div>
    );
  } else if (days < 0 || member.estado_pago === 'vencido' || member.estado_pago === 'pendiente' || member.estado_pago === 'saldo') {
    statusBadge = (
      <div className="bg-[#2a1317] border border-[#f87171]/40 text-[#f87171] font-semibold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
        <span>• {Math.abs(days)}d vencido</span>
      </div>
    );
  }

  // Payment badge styling
  let paymentBadge = (
    <span className="bg-emerald-950/70 border border-emerald-500/30 text-[#34d399] font-bold text-xs px-2.5 py-1 rounded-md text-center ml-auto">
      Pagado
    </span>
  );

  if (member.estado_pago === 'parcial') {
    paymentBadge = (
      <span className="bg-amber-950/70 border border-amber-500/30 text-[#fbbf24] font-bold text-xs px-2.5 py-1 rounded-md text-center ml-auto">
        Parcial
      </span>
    );
  } else if (member.estado_pago === 'pendiente' || member.estado_pago === 'saldo' || member.estado_pago === 'vencido') {
    paymentBadge = (
      <span className="bg-rose-950/70 border border-rose-500/30 text-[#f87171] font-bold text-xs px-2.5 py-1 rounded-md text-center ml-auto">
        Impago
      </span>
    );
  }

  const initials = getMemberInitials(member.nombre, member.apellido);

  return (
    <div className="bg-[#0e1626] border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-sm">
      {/* Row 1: Avatar initials + Name + Subtitle (discipline) + Status badge */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[#132d2c] border border-[#34d399]/30 text-[#34d399] font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden">
            {member.foto_url && !imgError ? (
              <img
                src={member.foto_url}
                alt={`${member.nombre} ${member.apellido}`}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-base text-white leading-tight truncate">
              {member.nombre} {member.apellido}
            </h4>
            <p className="text-xs text-slate-400 capitalize mt-0.5 truncate">
              {member.disciplina}
            </p>
          </div>
        </div>
        {statusBadge}
      </div>

      {/* Row 2: Grid: DNI, Vence, Pago status badge */}
      <div className="bg-[#090e17]/80 border border-slate-800/60 rounded-xl p-3 grid grid-cols-3 items-center gap-2">
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase block leading-none">DNI</span>
          <span className="text-xs font-bold text-white font-mono mt-1 block truncate">
            {member.dni}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-mono uppercase block leading-none">Vence</span>
          <span className="text-xs font-bold text-white font-mono mt-1 block truncate">
            {formatDisplayDate(member.fecha_vencimiento)}
          </span>
        </div>
        <div className="flex justify-end">
          {paymentBadge}
        </div>
      </div>

      {/* Row 3: Action Buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        {/* Left prominent Cobrar button */}
        <button
          onClick={() => onRenewClick(member)}
          className="bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 text-[#080c14] font-bold text-xs px-4 py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1.5 shadow-sm transition-all"
        >
          <CreditCard className="w-4 h-4 stroke-[2.5]" />
          <span>Cobrar</span>
        </button>

        {/* Right 4 icon buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onOpenCardModal(member)}
            title="Ver Carnet QR"
            className="w-9 h-9 rounded-xl bg-[#090e17] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all shadow-sm"
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
            className="w-9 h-9 rounded-xl bg-[#090e17] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
          </a>

          <button
            onClick={() => onOpenEditMember(member)}
            title="Editar socio"
            className="w-9 h-9 rounded-xl bg-[#090e17] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all shadow-sm"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDeleteClick(member)}
            title="Eliminar socio"
            className="w-9 h-9 rounded-xl bg-[#090e17] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-400 active:scale-95 transition-all shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
