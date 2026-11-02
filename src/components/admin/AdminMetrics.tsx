import React from 'react';
import { Users, Check, Clock, CircleAlert } from 'lucide-react';
import { Card } from '../ui';

export interface AdminMetricsProps {
  totalMembers: number;
  activeMembers: number;
  expiringTwoDaysMembers: number;
  expiredOrUnpaidMembers: number;
  onOpenExpiringModal?: () => void;
}

export const AdminMetrics: React.FC<AdminMetricsProps> = ({
  totalMembers,
  activeMembers,
  expiringTwoDaysMembers,
  expiredOrUnpaidMembers,
  onOpenExpiringModal,
}) => {
  const safeTotal = Math.max(totalMembers, 1);
  const activePct = totalMembers > 0 ? (activeMembers / safeTotal) * 100 : 0;
  const expiringPct = totalMembers > 0 ? (expiringTwoDaysMembers / safeTotal) * 100 : 0;
  const expiredPct = totalMembers > 0 ? (expiredOrUnpaidMembers / safeTotal) * 100 : 0;

  const metrics = [
    {
      id: 'total',
      label: 'Total socios',
      value: totalMembers,
      icon: Users,
      iconBg: 'bg-accent-soft',
      iconColor: 'text-accent',
      barColor: 'bg-accent',
      pct: 100,
      footer: 'Registrados en Acuva',
      onClick: undefined,
    },
    {
      id: 'active',
      label: 'Al día',
      value: activeMembers,
      icon: Check,
      iconBg: 'bg-accent-soft',
      iconColor: 'text-accent',
      barColor: 'bg-accent',
      pct: activePct,
      footer: `Membresía activa · ${activeMembers} de ${totalMembers}`,
      onClick: undefined,
    },
    {
      id: 'expiring',
      label: 'Vence ≤ 2 días',
      value: expiringTwoDaysMembers,
      icon: Clock,
      iconBg: 'bg-status-warn-soft',
      iconColor: 'text-status-warn',
      barColor: 'bg-status-warn',
      pct: expiringPct,
      footer: `Por renovar · ${expiringTwoDaysMembers} de ${totalMembers}`,
      onClick: onOpenExpiringModal,
    },
    {
      id: 'expired',
      label: 'Vencidos',
      value: expiredOrUnpaidMembers,
      icon: CircleAlert,
      iconBg: 'bg-status-danger-soft',
      iconColor: 'text-status-danger',
      barColor: 'bg-status-danger',
      pct: expiredPct,
      footer: 'Acceso denegado',
      onClick: undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 select-none">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card
            key={m.id}
            tabIndex={m.onClick ? 0 : undefined}
            role={m.onClick ? 'button' : undefined}
            onClick={m.onClick}
            onKeyDown={
              m.onClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      m.onClick?.();
                    }
                  }
                : undefined
            }
            className={`flex flex-col justify-between p-3.5 sm:p-[18px] ${
              m.onClick
                ? 'cursor-pointer hover:border-border-default transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
                : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-text-muted">
                {m.label}
              </span>
              <div
                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 ${m.iconBg} ${m.iconColor}`}
              >
                <Icon size={18} strokeWidth={2.5} />
              </div>
            </div>

            <div className="mt-2">
              <div className="text-[30px] font-extrabold text-text-primary tracking-tight leading-none">
                {m.value}
              </div>

              <div className="w-full h-1.5 rounded-full bg-surface-hover mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${m.barColor}`}
                  style={{ width: `${Math.min(100, Math.max(m.pct, 0))}%` }}
                />
              </div>

              <p className="text-xs text-text-muted mt-2 truncate">
                {m.footer}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
