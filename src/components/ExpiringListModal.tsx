import React, { useState, useMemo, useEffect } from 'react';
import { Member } from '../types';
import { getDaysRemaining, formatDisplayDate, buildWhatsAppLink } from '../lib/dateUtils';
import { MemberAvatar } from './MemberAvatar';
import { Pagination } from './Pagination';
import {
  X,
  MessageCircle,
  Clock,
  Send,
  Copy,
  Check,
  Calendar,
  Phone,
  Dumbbell,
  FileSpreadsheet
} from 'lucide-react';
import { exportCriticalMembersToExcel } from '../lib/excelExport';

interface ExpiringListModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
}

export const ExpiringListModal: React.FC<ExpiringListModalProps> = ({ isOpen, onClose, members }) => {
  const [filterType, setFilterType] = useState<'all_critical' | 'two_days' | 'today_tomorrow' | 'expired'>('all_critical');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  if (!isOpen) return null;

  const criticalMembers = members.filter((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    if (filterType === 'two_days') return days === 2;
    if (filterType === 'today_tomorrow') return days >= 0 && days <= 1;
    if (filterType === 'expired') return days < 0;
    return days <= 2;
  }).sort((a, b) => getDaysRemaining(a.fecha_vencimiento) - getDaysRemaining(b.fecha_vencimiento));

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  // Keep page within bounds
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(criticalMembers.length / PAGE_SIZE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [criticalMembers.length, currentPage]);

  const paginatedCriticalMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return criticalMembers.slice(start, start + PAGE_SIZE);
  }, [criticalMembers, currentPage]);

  const handleSendIndividual = (member: Member) => {
    const days = getDaysRemaining(member.fecha_vencimiento);
    const link = buildWhatsAppLink(
      member.nombre,
      member.disciplina,
      member.fecha_vencimiento,
      member.telefono,
      days
    );
    window.open(link, '_blank');
    setSentMap((prev) => ({ ...prev, [member.id]: true }));
  };

  const handleBulkSequential = () => {
    if (criticalMembers.length === 0) return;
    const confirmSend = window.confirm(
      `Se abrirán los chats de WhatsApp para los ${criticalMembers.length} socios. ¿Comenzar?`
    );
    if (!confirmSend) return;

    criticalMembers.forEach((member, index) => {
      setTimeout(() => {
        const days = getDaysRemaining(member.fecha_vencimiento);
        const link = buildWhatsAppLink(
          member.nombre,
          member.disciplina,
          member.fecha_vencimiento,
          member.telefono,
          days
        );
        window.open(link, '_blank');
        setSentMap((prev) => ({ ...prev, [member.id]: true }));
      }, index * 1200);
    });
  };

  const handleCopySummary = () => {
    const lines = criticalMembers.map((m) => {
      const days = getDaysRemaining(m.fecha_vencimiento);
      return `${m.nombre} ${m.apellido} (${m.disciplina}) - Tel: ${m.telefono} - Vence: ${m.fecha_vencimiento} (${days} días)`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2500);
  };

  const pendingCount = criticalMembers.filter((m) => !sentMap[m.id]).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0f172a] border border-[#34d399] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#34d399]/30 bg-[#0f172a] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#34d399] text-[#0f172a] flex items-center justify-center font-bold">
                <Clock className="w-4 h-4 text-[#0f172a]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wider">
                    Vencimientos (≤ 2 Días)
                  </h3>
                  <span className="bg-[#0f172a] text-white border border-[#34d399] text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                    {criticalMembers.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Avisos personalizados de WhatsApp (individual o masivo)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded hover:bg-[#1e293b] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters and Actions Bar - Mobile First */}
          <div className="p-3 bg-[#0f172a] border-b border-[#34d399]/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
              <button
                onClick={() => setFilterType('all_critical')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${filterType === 'all_critical'
                  ? 'bg-[#34d399] text-[#0f172a]'
                  : 'bg-[#0f172a] text-white hover:bg-[#1e293b] border border-[#34d399]/40'
                  }`}
              >
                Todos (≤ 2d)
              </button>
              <button
                onClick={() => setFilterType('two_days')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${filterType === 'two_days'
                  ? 'bg-[#34d399] text-[#0f172a]'
                  : 'bg-[#0f172a] text-white hover:bg-[#1e293b] border border-[#34d399]/40'
                  }`}
              >
                Exacto 2 días
              </button>
              <button
                onClick={() => setFilterType('today_tomorrow')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${filterType === 'today_tomorrow'
                  ? 'bg-[#34d399] text-[#0f172a]'
                  : 'bg-[#0f172a] text-white hover:bg-[#1e293b] border border-[#34d399]/40'
                  }`}
              >
                Hoy y Mañana
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => exportCriticalMembersToExcel(criticalMembers, filterType)}
                disabled={criticalMembers.length === 0}
                className="px-2.5 py-1 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 text-white text-xs rounded-md border border-[#34d399]/40 flex items-center gap-1 font-mono transition-colors shadow-sm"
                title="Descargar socios por vencer en Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Excel</span>
              </button>

              <button
                onClick={handleCopySummary}
                className="px-2.5 py-1 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs rounded-md border border-[#34d399]/40 flex items-center gap-1 font-mono"
              >
                {copiedBatch ? <Check className="w-3 h-3 text-[#34d399]" /> : <Copy className="w-3 h-3" />}
                {copiedBatch ? 'Copiado' : 'Copiar'}
              </button>

              <button
                onClick={handleBulkSequential}
                disabled={criticalMembers.length === 0}
                className="px-3 py-1 bg-[#34d399] hover:bg-[#34d399]/90 text-[#0f172a] text-xs font-black uppercase tracking-wider rounded-md flex items-center gap-1 disabled:opacity-40 active:scale-95 transition-all shadow-md"
              >
                <Send className="w-3 h-3 text-[#0f172a]" />
                <span>Enviar a Todos ({pendingCount})</span>
              </button>
            </div>
          </div>

          {/* List of members - Mobile card friendly */}
          <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2 bg-[#0f172a]">
            {criticalMembers.length === 0 ? (
              <div className="text-center py-12 text-slate-300 font-mono text-xs">
                No hay socios pendientes de aviso en este filtro.
              </div>
            ) : (
              paginatedCriticalMembers.map((member) => {
                const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
                const isSent = Boolean(sentMap[member.id]);

                return (
                  <div
                    key={member.id}
                    className="bg-[#0f172a] border border-[#34d399]/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <MemberAvatar
                        src={member.foto_url}
                        name={`${member.nombre} ${member.apellido}`}
                        className="w-10 h-10 rounded-lg"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs sm:text-sm text-white">
                            {member.nombre} {member.apellido}
                          </h4>
                          <span className="text-[10px] bg-[#0f172a] text-white px-1.5 py-0.2 rounded border border-[#34d399]/40 font-mono">
                            {member.disciplina}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono mt-0.5">
                          <span>Tel: {member.telefono}</span>
                          <span>•</span>
                          <span>Vence: {formatDisplayDate(member.fecha_vencimiento)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-[#34d399]/20">
                      <span className="font-mono text-[10px] uppercase font-bold text-white bg-[#0f172a] px-2 py-0.5 rounded border border-[#34d399]/40">
                        {daysRemaining < 0
                          ? `${Math.abs(daysRemaining)}d vencido`
                          : daysRemaining === 0
                            ? 'Vence hoy'
                            : `${daysRemaining} días restantes`}
                      </span>

                      <button
                        onClick={() => handleSendIndividual(member)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${isSent
                          ? 'bg-[#0f172a] text-slate-400 border border-[#34d399]/40'
                          : 'bg-[#34d399] hover:bg-[#34d399]/90 text-[#0f172a] active:scale-95 shadow'
                          }`}
                      >
                        {isSent ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" />
                            Enviado
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3 h-3" />
                            WhatsApp
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination footer */}
          {criticalMembers.length > 0 && (
            <div className="p-3 bg-[#0f172a] border-t border-[#34d399]/30 shrink-0">
              <Pagination
                currentPage={currentPage}
                totalItems={criticalMembers.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
                itemLabel="socios por vencer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
