import React from 'react';
import { Users, Check, Clock, AlertCircle } from 'lucide-react';

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

  return (
    <div>
      {/* DESKTOP VIEW (4 distinct cards in a 4-column grid) */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        {/* Card 1: Total socios */}
        <div className="bg-[#0e1626] hover:border-[#34d399]/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total socios</span>
            <div className="w-8 h-8 rounded-lg bg-[#122e2a] flex items-center justify-center text-[#34d399]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono mt-3">{totalMembers}</div>
            <div className="text-xs text-slate-400 mt-2">Registrados en Acuva</div>
          </div>
        </div>

        {/* Card 2: Al día */}
        <div className="bg-[#0e1626] hover:border-[#34d399]/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Al día</span>
            <div className="w-8 h-8 rounded-lg bg-[#122e2a] flex items-center justify-center text-[#34d399]">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono mt-3">{activeMembers}</div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#34d399] transition-all"
                style={{ width: `${Math.min(100, Math.round(activePct))}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Membresía activa · {activeMembers} de {totalMembers}
            </div>
          </div>
        </div>

        {/* Card 3: Vence <= 2 días */}
        <div
          className="bg-[#0e1626] hover:border-[#fbbf24]/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-colors"
          title="Ver socios por vencer en 2 días"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Vence ≤ 2 días</span>
            <div className="w-8 h-8 rounded-lg bg-[#2a2212] flex items-center justify-center text-[#fbbf24]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono mt-3">{expiringTwoDaysMembers}</div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#fbbf24] transition-all"
                style={{ width: `${Math.min(100, Math.round(expiringPct))}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Por renovar · {expiringTwoDaysMembers} de {totalMembers}
            </div>
          </div>
        </div>

        {/* Card 4: Vencidos */}
        <div className="bg-[#0e1626] hover:border-[#f87171]/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Vencidos</span>
            <div className="w-8 h-8 rounded-lg bg-[#2d1519] flex items-center justify-center text-[#f87171]">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-white font-mono mt-3">{expiredOrUnpaidMembers}</div>
            <div className="text-xs text-slate-400 mt-2">Acceso denegado</div>
          </div>
        </div>
      </div>

      {/* MOBILE VIEW (Single consolidated summary card) */}
      <div className="lg:hidden bg-[#0e1626] border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="text-xs font-medium text-slate-400">Total socios</div>
        <div className="flex items-baseline justify-between">
          <div className="text-4xl font-black text-white font-mono tracking-tight">{totalMembers}</div>
          <div className="text-xs text-slate-400">Registrados en Acuva</div>
        </div>

        {/* Multi-segment split bar */}
        <div className="h-2 w-full rounded-full bg-slate-800 flex overflow-hidden gap-0.5">
          {activePct > 0 && (
            <div
              className="h-full bg-[#34d399] rounded-full transition-all"
              style={{ width: `${activePct}%` }}
            />
          )}
          {expiringPct > 0 && (
            <div
              className="h-full bg-[#fbbf24] rounded-full transition-all"
              style={{ width: `${expiringPct}%` }}
            />
          )}
          {expiredPct > 0 && (
            <div
              className="h-full bg-[#f87171] rounded-full transition-all"
              style={{ width: `${expiredPct}%` }}
            />
          )}
        </div>

        {/* Legend below with dots */}
        <div className="flex items-center justify-between text-xs pt-1 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#34d399] shrink-0" />
            <span>Al día {activeMembers}</span>
          </div>
          <button
            type="button"
            onClick={onOpenExpiringModal}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#fbbf24] shrink-0" />
            <span>≤ 2 días {expiringTwoDaysMembers}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f87171] shrink-0" />
            <span>Vencidos {expiredOrUnpaidMembers}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

