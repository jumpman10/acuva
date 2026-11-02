import React, { useState, useMemo, useEffect } from 'react';
import { Member, AccessLog, PaymentLog, RenewMemberOptions } from '../types';
import { getMembershipTone, formatMoney, formatShortDate } from '../lib/status';
import { RenewMemberModal } from './RenewMemberModal';
import { VirtualCardModal } from './VirtualCardModal';
import { MemberDetailDrawer } from './MemberDetailDrawer';
import { Pagination } from './Pagination';
import { AdminMetrics } from './admin/AdminMetrics';
import { AdminFiltersBar } from './admin/AdminFiltersBar';
import { AdminMembersTable } from './admin/AdminMembersTable';
import { AdminMemberCard } from './admin/AdminMemberCard';
import { Card, MemberAvatar, StatusBadge, Button } from './ui';
import {
  ScanLine,
  FileSpreadsheet,
  Check,
  X,
} from 'lucide-react';
import {
  exportMembersToExcel,
  exportAccessLogsToExcel,
  exportPaymentLogsToExcel,
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
  onRenewMember,
  onOpenScanner,
  onOpenExpiringModal,
  onOpenCardModal,
  activeTab: controlledActiveTab,
  onTabChange,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'members' | 'access_logs' | 'payment_logs'
  >('members');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'por_vencer' | 'vencido'>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [cardModalMember, setCardModalMember] = useState<Member | null>(null);
  const [returnToFichaMember, setReturnToFichaMember] = useState<Member | null>(null);

  // Keep detailMember in sync with live members list if updated
  const activeDetailMember = useMemo(() => {
    if (!detailMember) return null;
    return members.find((m) => m.id === detailMember.id) || detailMember;
  }, [detailMember, members]);

  // Ficha actions
  const handleCobrarFromFicha = (m: Member) => {
    setReturnToFichaMember(m);
    setDetailMember(null);
    setRenewingMember(m);
  };

  const handleVerCarnetFromFicha = (m: Member) => {
    setReturnToFichaMember(m);
    setDetailMember(null);
    setCardModalMember(m);
  };

  const handleEditarFromFicha = (m: Member) => {
    setDetailMember(null);
    onOpenEditMember(m);
  };

  const handleBackFromRenew = () => {
    const target = returnToFichaMember;
    setRenewingMember(null);
    setReturnToFichaMember(null);
    if (target) {
      setDetailMember(target);
    }
  };

  const handleBackFromCard = () => {
    const target = returnToFichaMember;
    setCardModalMember(null);
    setReturnToFichaMember(null);
    if (target) {
      setDetailMember(target);
    }
  };

  // Statistics using getMembershipTone
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => getMembershipTone(m).status === 'activo').length;
  const expiringTwoDaysMembers = members.filter((m) => getMembershipTone(m).status === 'por_vencer').length;
  const expiredOrUnpaidMembers = members.filter((m) => getMembershipTone(m).status === 'vencido').length;

  const disciplinesList = useMemo(() => {
    if (disciplines && disciplines.length > 0) {
      return disciplines.map((d) => d.nombre);
    }
    return Array.from(new Set(members.map((m) => m.disciplina).filter(Boolean)));
  }, [disciplines, members]);

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.nombre.toLowerCase().includes(q) ||
        m.apellido.toLowerCase().includes(q) ||
        m.dni.includes(q) ||
        m.telefono.includes(q);

      if (!matchesSearch) return false;

      if (disciplineFilter !== 'all' && m.disciplina !== disciplineFilter) {
        return false;
      }

      const tone = getMembershipTone(m);
      if (statusFilter === 'activo') return tone.status === 'activo';
      if (statusFilter === 'por_vencer') return tone.status === 'por_vencer';
      if (statusFilter === 'vencido') return tone.status === 'vencido';

      return true;
    });
  }, [members, searchQuery, disciplineFilter, statusFilter]);

  // Pagination configuration
  const PAGE_SIZE = 15;
  const [membersPage, setMembersPage] = useState(1);
  const [accessLogsPage, setAccessLogsPage] = useState(1);
  const [paymentLogsPage, setPaymentLogsPage] = useState(1);

  useEffect(() => {
    setMembersPage(1);
  }, [searchQuery, statusFilter, disciplineFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    if (membersPage > maxPage) setMembersPage(maxPage);
  }, [filteredMembers.length, membersPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(accessLogs.length / PAGE_SIZE));
    if (accessLogsPage > maxPage) setAccessLogsPage(maxPage);
  }, [accessLogs.length, accessLogsPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(paymentLogs.length / PAGE_SIZE));
    if (paymentLogsPage > maxPage) setPaymentLogsPage(maxPage);
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

  // Date for Content Header: "Lunes 2 de noviembre"
  const longDate = useMemo(() => {
    const d = new Date();
    const str = d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return (str.charAt(0).toUpperCase() + str.slice(1)).replace(',', '');
  }, []);

  const tabTitle =
    activeTab === 'members'
      ? 'Socios'
      : activeTab === 'access_logs'
      ? 'Portería'
      : 'Pagos';

  // --- Portería helpers & metrics ---
  const todayLogs = useMemo(() => {
    const now = new Date();
    return accessLogs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return (
        logDate.getFullYear() === now.getFullYear() &&
        logDate.getMonth() === now.getMonth() &&
        logDate.getDate() === now.getDate()
      );
    });
  }, [accessLogs]);

  const authorizedToday = todayLogs.filter((l) => l.autorizado).length;
  const deniedToday = todayLogs.filter((l) => !l.autorizado).length;
  const totalToday = todayLogs.length;

  const groupedAccessLogs = useMemo(() => {
    const groups: { [key: string]: { label: string; logs: AccessLog[] } } = {};
    const now = new Date();

    const getLabel = (d: Date) => {
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      if (isToday) return 'Hoy';

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
      if (isYesterday) return 'Ayer';

      const raw = d.toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
      }).replace('.', '');
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    paginatedAccessLogs.forEach((log) => {
      const date = new Date(log.timestamp);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      if (!groups[key]) {
        groups[key] = {
          label: getLabel(date),
          logs: [],
        };
      }
      groups[key].logs.push(log);
    });

    return Object.entries(groups).map(([dateKey, group]) => ({
      dateKey,
      label: group.label,
      logs: group.logs,
    }));
  }, [paginatedAccessLogs]);

  // --- Pagos helpers & metrics ---
  const paymentStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentPayments = paymentLogs.filter((p) => {
      const payDate = new Date(p.fecha);
      return payDate >= thirtyDaysAgo;
    });

    const activeList = recentPayments.length > 0 ? recentPayments : paymentLogs;
    const totalRecaudado = activeList.reduce((sum, p) => sum + (p.monto || 0), 0);

    const methodTotals: Record<string, number> = {
      Efectivo: 0,
      Transferencia: 0,
      Débito: 0,
      Crédito: 0,
      'Pago QR': 0,
    };

    const normalize = (raw: string): string => {
      const lower = raw.toLowerCase();
      if (lower.includes('efectivo')) return 'Efectivo';
      if (lower.includes('transferencia')) return 'Transferencia';
      if (lower.includes('débito') || lower.includes('debito')) return 'Débito';
      if (lower.includes('crédito') || lower.includes('credito')) return 'Crédito';
      if (lower.includes('qr')) return 'Pago QR';
      return 'Transferencia';
    };

    activeList.forEach((p) => {
      if (p.detalles && p.detalles.length > 0) {
        p.detalles.forEach((d) => {
          const norm = normalize(d.metodo);
          methodTotals[norm] = (methodTotals[norm] || 0) + (d.monto || 0);
        });
      } else {
        const norm = normalize(p.metodo || 'Efectivo');
        methodTotals[norm] = (methodTotals[norm] || 0) + (p.monto || 0);
      }
    });

    return {
      totalRecaudado,
      methodTotals,
    };
  }, [paymentLogs]);

  const formatPaymentMethod = (pay: PaymentLog): string => {
    if (pay.detalles && pay.detalles.length > 1) {
      return pay.detalles
        .map((d) => d.metodo.replace('Tarjeta de ', ''))
        .join(' + ');
    }
    return (pay.metodo || 'Efectivo').replace('Tarjeta de ', '');
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header de contenido: fecha larga y título de la pestaña; a la derecha Button primary "Escanear QR" */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-text-muted">{longDate}</p>
          <h1 className="text-[28px] font-extrabold text-text-primary tracking-tight leading-tight">
            {tabTitle}
          </h1>
        </div>

        <div className="hidden lg:block">
          <Button
            variant="primary"
            icon={ScanLine}
            onClick={onOpenScanner}
          >
            Escanear QR
          </Button>
        </div>
      </div>

      {/* PESTAÑA: SOCIOS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* AdminMetrics */}
          <AdminMetrics
            totalMembers={totalMembers}
            activeMembers={activeMembers}
            expiringTwoDaysMembers={expiringTwoDaysMembers}
            expiredOrUnpaidMembers={expiredOrUnpaidMembers}
            onOpenExpiringModal={onOpenExpiringModal}
          />

          {/* AdminFiltersBar */}
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
            onOpenNewMember={onOpenNewMember}
          />

          {/* Mobile view: AdminMemberCards */}
          <div className="block lg:hidden space-y-3">
            {filteredMembers.length === 0 ? (
              <Card className="p-8 text-center text-text-muted text-sm">
                No hay socios con estos filtros.
              </Card>
            ) : (
              paginatedMembers.map((member) => (
                <AdminMemberCard
                  key={member.id}
                  member={member}
                  onRenewClick={(m) => setRenewingMember(m)}
                  onOpenCardModal={onOpenCardModal}
                  onOpenEditMember={onOpenEditMember}
                  onSelectMember={(m) => setDetailMember(m)}
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

          {/* Desktop view: AdminMembersTable */}
          <div className="hidden lg:block space-y-3">
            <AdminMembersTable
              members={paginatedMembers}
              onRenewClick={(m) => setRenewingMember(m)}
              onOpenCardModal={onOpenCardModal}
              onOpenEditMember={onOpenEditMember}
              onSelectMember={(m) => setDetailMember(m)}
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

      {/* PESTAÑA: PORTERÍA (access_logs) */}
      {activeTab === 'access_logs' && (
        <div className="space-y-4">
          {/* 3 métricas chicas (Ingresos hoy, Autorizados en status-ok, Denegados en status-danger) */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 select-none">
            <Card className="flex flex-col justify-between p-3.5 sm:p-[18px]">
              <span className="text-[13px] font-semibold text-text-muted">
                Ingresos hoy
              </span>
              <div className="text-[26px] sm:text-[30px] font-extrabold text-text-primary font-mono mt-2 leading-none">
                {totalToday}
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-3.5 sm:p-[18px]">
              <span className="text-[13px] font-semibold text-text-muted">
                Autorizados
              </span>
              <div className="text-[26px] sm:text-[30px] font-extrabold text-status-ok font-mono mt-2 leading-none">
                {authorizedToday}
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-3.5 sm:p-[18px]">
              <span className="text-[13px] font-semibold text-text-muted">
                Denegados
              </span>
              <div className="text-[26px] sm:text-[30px] font-extrabold text-status-danger font-mono mt-2 leading-none">
                {deniedToday}
              </div>
            </Card>
          </div>

          {/* Header row with Excel export */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-text-muted font-mono">
              {accessLogs.length} accesos registrados
            </span>
            <Button
              variant="secondary"
              icon={FileSpreadsheet}
              onClick={() => exportAccessLogsToExcel(accessLogs)}
              disabled={accessLogs.length === 0}
            >
              Excel
            </Button>
          </div>

          {/* Lista agrupada por día ("Hoy", "Ayer", fecha) con contador */}
          {groupedAccessLogs.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-sm">
              No hay registros de accesos todavía.
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedAccessLogs.map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-text-primary">
                      {group.label}
                    </h3>
                    <span className="text-xs text-text-muted font-mono">
                      {group.logs.length}{' '}
                      {group.logs.length === 1 ? 'ingreso' : 'ingresos'}
                    </span>
                  </div>

                  <Card className="p-0 overflow-hidden divide-y divide-border-subtle select-none">
                    {group.logs.map((log) => (
                      <div
                        key={log.id}
                        className="px-4 py-3 hover:bg-surface-200 transition-colors flex items-center justify-between gap-3"
                      >
                        {/* Avatar 38px + Nombre + Disciplina y motivo en text-text-muted */}
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar
                            name={log.member_name}
                            className="w-[38px] h-[38px]"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-text-primary text-sm truncate">
                              {log.member_name}
                            </p>
                            <p className="text-xs text-text-muted truncate mt-0.5">
                              {log.disciplina}
                              {log.motivo ? ` · ${log.motivo}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Hora mono y StatusBadge con icono Check "Autorizado" (ok) o X "Denegado" (danger) */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-xs text-text-muted">
                            {new Date(log.timestamp).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </span>
                          {log.autorizado ? (
                            <StatusBadge tone="ok" icon={Check}>
                              Autorizado
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="danger" icon={X}>
                              Denegado
                            </StatusBadge>
                          )}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          )}

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

      {/* PESTAÑA: PAGOS (payment_logs) */}
      {activeTab === 'payment_logs' && (
        <div className="space-y-4">
          {/* Card "Recaudado · últimos 30 días" con el total grande y desglose "Por método" */}
          <Card className="p-5 sm:p-6 space-y-4 select-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[13px] font-semibold text-text-muted">
                  Recaudado · últimos 30 días
                </span>
                <div className="text-[32px] sm:text-[36px] font-extrabold text-text-primary font-mono mt-1 leading-tight">
                  {formatMoney(paymentStats.totalRecaudado)}
                </div>
              </div>

              <Button
                variant="secondary"
                icon={FileSpreadsheet}
                onClick={() => exportPaymentLogsToExcel(paymentLogs, members)}
                disabled={paymentLogs.length === 0}
                className="self-start sm:self-auto"
              >
                Excel
              </Button>
            </div>

            {/* Desglose "Por método" (Efectivo, Transferencia, Débito, Crédito, Pago QR) */}
            <div className="pt-3 border-t border-border-subtle space-y-2.5">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                Por método
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(paymentStats.methodTotals).map(
                  ([method, amount]) => {
                    const pct =
                      paymentStats.totalRecaudado > 0
                        ? (amount / paymentStats.totalRecaudado) * 100
                        : 0;
                    return (
                      <div
                        key={method}
                        className="bg-surface-200/60 rounded-xl p-3 border border-border-subtle flex flex-col justify-between gap-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary font-medium">
                            {method}
                          </span>
                          <span className="font-mono text-text-muted text-[11px]">
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="text-sm font-bold font-mono text-text-primary">
                          {formatMoney(amount)}
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </Card>

          {/* Debajo lista "Cobros y renovaciones": avatar, nombre, fecha, período, método, monto y nota */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-text-primary">
                Cobros y renovaciones
              </h3>
              <span className="text-xs text-text-muted font-mono">
                {paymentLogs.length} registros
              </span>
            </div>

            <Card className="p-0 overflow-hidden divide-y divide-border-subtle select-none">
              {paginatedPaymentLogs.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">
                  No hay registros de pagos recientes.
                </div>
              ) : (
                paginatedPaymentLogs.map((pay) => {
                  const member = members.find((m) => m.id === pay.member_id);
                  const memberName = member
                    ? `${member.nombre} ${member.apellido}`
                    : 'Socio';
                  const methodStr = formatPaymentMethod(pay);

                  return (
                    <div
                      key={pay.id}
                      className="p-3.5 sm:px-4 sm:py-3.5 hover:bg-surface-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      {/* Avatar, nombre, fecha, período y nota */}
                      <div className="flex items-center gap-3 min-w-0">
                        <MemberAvatar
                          src={member?.foto_url}
                          name={memberName}
                          className="w-10 h-10"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary text-sm truncate">
                            {memberName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
                            <span>{formatShortDate(pay.fecha)}</span>
                            <span>·</span>
                            <span className="font-mono text-text-secondary">
                              {formatShortDate(pay.periodo_inicio)} →{' '}
                              {formatShortDate(pay.periodo_fin)}
                            </span>
                          </div>
                          {pay.notas && (
                            <p className="text-xs text-status-warn italic mt-1 font-sans">
                              Nota: {pay.notas}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Método (pagos mixtos como "Efectivo + Transferencia") y monto font-bold */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-13 sm:pl-0">
                        <span className="text-xs font-medium text-text-muted bg-surface-200 px-2.5 py-1 rounded-md border border-border-subtle">
                          {methodStr}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-text-primary">
                          {formatMoney(pay.monto)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            <Pagination
              currentPage={paymentLogsPage}
              totalItems={paymentLogs.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPaymentLogsPage}
              itemLabel="pagos"
              className="pt-2"
            />
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      <RenewMemberModal
        isOpen={Boolean(renewingMember)}
        onClose={() => {
          setRenewingMember(null);
          setReturnToFichaMember(null);
        }}
        onBack={returnToFichaMember ? handleBackFromRenew : undefined}
        member={renewingMember}
        disciplines={disciplines}
        onConfirmRenew={async (id, options) => {
          await onRenewMember(id, options);
          setRenewingMember(null);
          setReturnToFichaMember(null);
        }}
      />

      {/* Virtual Card Modal (opened from Ficha with onBack) */}
      <VirtualCardModal
        isOpen={Boolean(cardModalMember)}
        onClose={() => {
          setCardModalMember(null);
          setReturnToFichaMember(null);
        }}
        onBack={returnToFichaMember ? handleBackFromCard : undefined}
        member={cardModalMember}
      />

      {/* Ficha del socio Drawer */}
      <MemberDetailDrawer
        isOpen={Boolean(activeDetailMember)}
        onClose={() => {
          setDetailMember(null);
          setReturnToFichaMember(null);
        }}
        member={activeDetailMember}
        accessLogs={accessLogs}
        paymentLogs={paymentLogs}
        onCobrar={handleCobrarFromFicha}
        onEditar={handleEditarFromFicha}
        onVerCarnet={handleVerCarnetFromFicha}
      />
    </div>
  );
};
