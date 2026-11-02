import React, { useState, useMemo, useEffect } from 'react';
import { Member, AccessLog, PaymentLog, RenewMemberOptions } from '../types';
import { getCalculatedStatus, getDaysRemaining, formatDisplayDate } from '../lib/dateUtils';
import { RenewMemberModal } from './RenewMemberModal';
import { Pagination } from './Pagination';
import { AdminMetrics } from './admin/AdminMetrics';
import { AdminFiltersBar } from './admin/AdminFiltersBar';
import { AdminMembersTable } from './admin/AdminMembersTable';
import { AdminMemberCard } from './admin/AdminMemberCard';
import {
  Users,
  UserPlus,
  QrCode,
  CreditCard,
  History,
  FileSpreadsheet
} from 'lucide-react';
import {
  exportMembersToExcel,
  exportAccessLogsToExcel,
  exportPaymentLogsToExcel
} from '../lib/excelExport';

interface AdminDashboardProps {
  members: Member[];
  accessLogs: AccessLog[];
  paymentLogs: PaymentLog[];
  disciplines?: { id: string; nombre: string; precio: number }[];
  onOpenNewMember: () => void;
  onOpenEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => Promise<void>;
  onRenewMember: (id: string, options?: RenewMemberOptions) => Promise<void>;
  onOpenScanner: () => void;
  onOpenExpiringModal: () => void;
  onOpenCardModal: (member: Member) => void;
  activeTab?: 'members' | 'access_logs' | 'payment_logs';
  onTabChange?: (tab: 'members' | 'access_logs' | 'payment_logs') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  members,
  accessLogs,
  paymentLogs,
  disciplines = [],
  onOpenNewMember,
  onOpenEditMember,
  onDeleteMember,
  onRenewMember,
  onOpenScanner,
  onOpenExpiringModal,
  onOpenCardModal,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'members' | 'access_logs' | 'payment_logs'>('members');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: 'members' | 'access_logs' | 'payment_logs') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'por_vencer' | 'vencido'>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);

  // Statistics
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => {
    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    return s.membershipStatus === 'activo';
  }).length;

  const expiringTwoDaysMembers = members.filter((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    return days >= 0 && days <= 2 && m.estado_pago === 'pagado';
  }).length;

  const expiredOrUnpaidMembers = members.filter((m) => {
    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    return s.membershipStatus === 'vencido';
  }).length;

  const estimatedMonthlyRevenue = members.reduce((sum, m) => sum + (m.monto_mensual || 25000), 0);

  const disciplinesList = useMemo(() => {
    if (disciplines && disciplines.length > 0) {
      return disciplines.map((d) => d.nombre);
    }
    return Array.from(new Set(members.map((m) => m.disciplina).filter(Boolean)));
  }, [disciplines, members]);

  // Filter members
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.dni.includes(searchQuery) ||
      m.telefono.includes(searchQuery);

    if (!matchesSearch) return false;

    if (disciplineFilter !== 'all' && m.disciplina !== disciplineFilter) {
      return false;
    }

    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    if (statusFilter === 'activo') return s.membershipStatus === 'activo';
    if (statusFilter === 'por_vencer') return s.membershipStatus === 'por_vencer';
    if (statusFilter === 'vencido') return s.membershipStatus === 'vencido';

    return true;
  });

  // Pagination configuration (15 items max per page)
  const PAGE_SIZE = 15;
  const [membersPage, setMembersPage] = useState(1);
  const [accessLogsPage, setAccessLogsPage] = useState(1);
  const [paymentLogsPage, setPaymentLogsPage] = useState(1);

  // Reset page when member filters change
  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, statusFilter, disciplineFilter]);

  // Keep page within valid bounds if records change
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    if (membersPage > maxPage) {
      setMembersPage(maxPage);
    }
  }, [filteredMembers.length, membersPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(accessLogs.length / PAGE_SIZE));
    if (accessLogsPage > maxPage) {
      setAccessLogsPage(maxPage);
    }
  }, [accessLogs.length, accessLogsPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(paymentLogs.length / PAGE_SIZE));
    if (paymentLogsPage > maxPage) {
      setPaymentLogsPage(maxPage);
    }
  }, [paymentLogs.length, paymentLogsPage]);

  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * PAGE_SIZE;
    return filteredMembers.slice(start, start + PAGE_SIZE);
  }, [filteredMembers, membersPage]);

  const paginatedAccessLogs = useMemo(() => {
    const start = (accessLogsPage - 1) * PAGE_SIZE;
    return accessLogs.slice(start, start + PAGE_SIZE);
  }, [accessLogs, accessLogsPage]);

  const paginatedPaymentLogs = useMemo(() => {
    const start = (paymentLogsPage - 1) * PAGE_SIZE;
    return paymentLogs.slice(start, start + PAGE_SIZE);
  }, [paymentLogs, paymentLogsPage]);

  const handleRenewClick = (member: Member) => {
    setRenewingMember(member);
  };

  const handleDeleteClick = async (member: Member) => {
    const confirmDelete = window.confirm(
      `¿Eliminar a ${member.nombre} ${member.apellido} (DNI: ${member.dni})?`
    );
    if (confirmDelete) {
      await onDeleteMember(member.id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Desktop Header Row (Socios) */}
      {activeTab === 'members' && (
        <div className="hidden lg:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Socios</h1>
            <p className="text-xs text-slate-400 mt-0.5">{members.length} registrados en Acuva</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenNewMember}
              className="px-3.5 py-2 bg-[#0c1322] hover:bg-[#131c30] text-[#34d399] border border-[#34d399] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <UserPlus className="w-4 h-4 stroke-[2]" />
              <span>Nuevo socio</span>
            </button>
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 bg-[#34d399] hover:bg-[#34d399]/90 text-[#080c14] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <QrCode className="w-4 h-4 stroke-[2.5]" />
              <span>Escanear QR</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Header Row (Portería) */}
      {activeTab === 'access_logs' && (
        <div className="hidden lg:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portería</h1>
            <p className="text-xs text-slate-400 mt-0.5">{accessLogs.length} registros de accesos</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 bg-[#34d399] hover:bg-[#34d399]/90 text-[#080c14] rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <QrCode className="w-4 h-4 stroke-[2.5]" />
              <span>Escanear QR</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Header Row (Pagos) */}
      {activeTab === 'payment_logs' && (
        <div className="hidden lg:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Pagos</h1>
            <p className="text-xs text-slate-400 mt-0.5">{paymentLogs.length} registros de pagos y renovaciones</p>
          </div>
        </div>
      )}

      {/* Metrics Banner - Shown on members tab */}
      {activeTab === 'members' && (
        <AdminMetrics
          totalMembers={totalMembers}
          activeMembers={activeMembers}
          expiringTwoDaysMembers={expiringTwoDaysMembers}
          expiredOrUnpaidMembers={expiredOrUnpaidMembers}
          onOpenExpiringModal={onOpenExpiringModal}
        />
      )}

      {/* TAB 1: MEMBERS MANAGEMENT */}
      {activeTab === 'members' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Filters Bar */}
          <AdminFiltersBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            disciplineFilter={disciplineFilter}
            onDisciplineFilterChange={setDisciplineFilter}
            disciplinesList={disciplinesList}
            totalMembers={totalMembers}
            activeMembers={activeMembers}
            expiringMembers={expiringTwoDaysMembers}
            expiredMembers={expiredOrUnpaidMembers}
            onExportExcel={() => exportMembersToExcel(filteredMembers)}
            exportDisabled={filteredMembers.length === 0}
          />

          {/* MOBILE VIEW: CARDS (Visible on sm and down) */}
          <div className="block lg:hidden space-y-3">
            {/* Mobile Header Row */}
            <div className="flex items-center justify-between pt-1 pb-0.5 px-0.5">
              <h2 className="text-lg font-bold text-white tracking-tight">Socios</h2>
              <button
                onClick={onOpenNewMember}
                className="text-xs font-semibold text-[#34d399] flex items-center gap-1 active:scale-95 transition-transform"
              >
                <UserPlus className="w-4 h-4 stroke-[2]" />
                <span>Nuevo socio</span>
              </button>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">No se encontraron socios</p>
                <p className="text-xs text-slate-400 mt-0.5">Prueba cambiando los filtros</p>
              </div>
            ) : (
              paginatedMembers.map((member) => (
                <AdminMemberCard
                  key={member.id}
                  member={member}
                  onRenewClick={handleRenewClick}
                  onOpenCardModal={onOpenCardModal}
                  onOpenEditMember={onOpenEditMember}
                  onDeleteClick={handleDeleteClick}
                />
              ))
            )}

            <Pagination
              currentPage={membersPage}
              totalItems={filteredMembers.length}
              pageSize={PAGE_SIZE}
              onPageChange={setMembersPage}
              itemLabel="socios"
              className="pt-2"
            />
          </div>

          {/* DESKTOP VIEW: TABLE (Visible on lg and up) */}
          <div className="hidden lg:block space-y-3">
            <AdminMembersTable
              members={paginatedMembers}
              onRenewClick={handleRenewClick}
              onOpenCardModal={onOpenCardModal}
              onOpenEditMember={onOpenEditMember}
              onDeleteClick={handleDeleteClick}
            />

            <Pagination
              currentPage={membersPage}
              totalItems={filteredMembers.length}
              pageSize={PAGE_SIZE}
              onPageChange={setMembersPage}
              itemLabel="socios"
              className="pt-2"
            />
          </div>
        </div>
      )}

      {/* TAB 2: ACCESS LOGS (PORTERÍA) */}
      {activeTab === 'access_logs' && (
        <div className="bg-[#0f172a] border border-[#34d399]/30 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-[#34d399]/20 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#34d399]" />
                Registro de Ingresos en Portería (Escaneos QR)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Historial de validaciones generadas por escáner
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportAccessLogsToExcel(accessLogs)}
                disabled={accessLogs.length === 0}
                className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#34d399]/20 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-lg border border-[#34d399]/40 flex items-center gap-1.5 transition-colors shadow-sm"
                title="Descargar accesos en Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Exportar Excel</span>
              </button>
              <button
                onClick={onOpenScanner}
                className="px-3 py-1.5 bg-[#34d399] hover:bg-[#34d399]/90 text-[#0f172a] text-xs font-black rounded-lg shadow-sm"
              >
                Escanear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0f172a] text-slate-300 uppercase tracking-wider text-[11px] sm:text-xs font-mono border-b border-[#34d399]/30">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">DNI</th>
                  <th className="py-2.5 px-3">Disciplina</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#34d399]/15 font-mono">
                {accessLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No hay registros de accesos todavía.
                    </td>
                  </tr>
                ) : (
                  paginatedAccessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#34d399]/5 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 text-xs">
                        {new Date(log.timestamp).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white font-sans">{log.member_name}</td>
                      <td className="py-2.5 px-3 text-white">{log.dni}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs bg-[#0f172a] text-white px-2 py-0.5 rounded border border-[#34d399]/40">
                          {log.disciplina}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${log.autorizado
                            ? 'bg-[#34d399] text-[#0f172a] font-black'
                            : 'bg-[#0f172a] text-red-400 border border-red-500/40'
                            }`}
                        >
                          {log.autorizado ? 'AUTORIZADO' : 'DENEGADO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs font-sans">{log.motivo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={accessLogsPage}
            totalItems={accessLogs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setAccessLogsPage}
            itemLabel="ingresos"
            className="pt-2"
          />
        </div>
      )}

      {/* TAB 3: PAYMENT LOGS */}
      {activeTab === 'payment_logs' && (
        <div className="bg-[#0f172a] border border-[#34d399]/30 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#34d399]/20 pb-3 gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#34d399]" />
                Historial de Cobros y Renovaciones
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro de pagos de cuotas mensuales
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => exportPaymentLogsToExcel(paymentLogs, members)}
                disabled={paymentLogs.length === 0}
                className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#34d399]/20 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-lg border border-[#34d399]/40 flex items-center gap-1.5 transition-colors shadow-sm"
                title="Descargar cobros en Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Exportar Excel</span>
              </button>
              <div className="text-xs text-[#34d399] font-bold bg-[#0f172a] border border-[#34d399]/40 px-3 py-1.5 rounded-lg font-mono">
                Recaudación Estimada: ${estimatedMonthlyRevenue.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0f172a] text-slate-300 uppercase tracking-wider text-[11px] sm:text-xs border-b border-[#34d399]/30">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">Monto</th>
                  <th className="py-2.5 px-3">Método</th>
                  <th className="py-2.5 px-3">Período Renovado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#34d399]/15">
                {paymentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                      No hay registros de pagos recientes en esta sesión.
                    </td>
                  </tr>
                ) : (
                  paginatedPaymentLogs.map((pay) => {
                    const member = members.find((m) => m.id === pay.member_id);
                    return (
                      <tr key={pay.id} className="hover:bg-[#34d399]/5 transition-colors">
                        <td className="py-2.5 px-3 text-slate-300 text-xs">
                          {formatDisplayDate(pay.fecha)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white font-sans">
                          {member ? `${member.nombre} ${member.apellido}` : 'Socio'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white font-mono">
                          ${pay.monto.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-xs bg-[#0f172a] text-white px-2 py-0.5 rounded border border-[#34d399]/40 font-bold inline-block">
                              {pay.metodo}
                            </span>
                            {pay.detalles && pay.detalles.length > 1 && (
                              <div className="flex flex-wrap gap-1 text-[11px] font-mono text-slate-300">
                                {pay.detalles.map((d, idx) => (
                                  <span key={idx} className="bg-[#0f172a] px-1.5 py-0.5 rounded border border-[#34d399]/30 text-white">
                                    {d.metodo}: ${d.monto.toLocaleString('es-AR')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 text-xs">
                          <div>
                            {formatDisplayDate(pay.periodo_inicio)} al {formatDisplayDate(pay.periodo_fin)}
                          </div>
                          {pay.notas && (
                            <div className="text-[11px] text-slate-400 italic mt-0.5 font-sans">
                              Nota: {pay.notas}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={paymentLogsPage}
            totalItems={paymentLogs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPaymentLogsPage}
            itemLabel="pagos"
            className="pt-2"
          />
        </div>
      )}

      {/* Renewal Modal */}
      <RenewMemberModal
        isOpen={Boolean(renewingMember)}
        onClose={() => setRenewingMember(null)}
        member={renewingMember}
        disciplines={disciplines}
        onConfirmRenew={async (id, options) => {
          await onRenewMember(id, options);
          setRenewingMember(null);
        }}
      />
    </div>
  );
};
