import React from 'react';
import { User } from '../../lib/supabase';
import { Users, History, CreditCard, SlidersHorizontal, QrCode, LogOut } from 'lucide-react';

export interface AdminSidebarProps {
  activeTab: 'members' | 'access_logs' | 'payment_logs';
  onTabChange: (tab: 'members' | 'access_logs' | 'payment_logs') => void;
  membersCount: number;
  accessLogsCount: number;
  paymentLogsCount: number;
  onOpenConfigModal: () => void;
  adminUser: User | null;
  onLogoutAdmin: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onTabChange,
  membersCount,
  accessLogsCount,
  paymentLogsCount,
  onOpenConfigModal,
  adminUser,
  onLogoutAdmin,
}) => {
  const getInitials = (user: User | null): string => {
    if (!user || !user.email) return 'AD';
    if (user.email.toLowerCase().includes('juampy')) return 'JP';
    const name = user.user_metadata?.name || user.email.split('@')[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navItems = [
    {
      id: 'members' as const,
      label: 'Socios',
      icon: Users,
      count: membersCount,
    },
    {
      id: 'access_logs' as const,
      label: 'Portería',
      icon: History,
      count: accessLogsCount,
    },
    {
      id: 'payment_logs' as const,
      label: 'Pagos',
      icon: CreditCard,
      count: paymentLogsCount,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 h-screen sticky top-0 bg-[#0b111e] border-r border-slate-800/80 p-4 text-white z-30 select-none">
      {/* Top Section */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#34d399] flex items-center justify-center text-[#080c14] shadow-sm shrink-0">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Acuva</span>
          </div>
          <span className="bg-[#34d399] text-[#080c14] font-black text-[10px] px-2 py-0.5 rounded-full tracking-wider uppercase leading-none">
            ADMIN
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#132d2c] text-[#34d399] border border-[#34d399]/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#34d399]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    isActive ? 'text-[#34d399]' : 'text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}

          {/* Configurar */}
          <button
            onClick={onOpenConfigModal}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent transition-all"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <span>Configurar</span>
          </button>
        </nav>
      </div>

      {/* Bottom Profile Card */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center min-w-0 mr-2">
          <div className="w-9 h-9 rounded-full bg-[#132d2c] text-[#34d399] border border-[#34d399]/30 font-bold text-xs flex items-center justify-center shrink-0">
            {getInitials(adminUser)}
          </div>
          <div className="min-w-0 ml-3">
            <p className="text-xs font-bold text-white truncate leading-tight">Administrador</p>
            <p className="text-[11px] text-slate-400 truncate max-w-[110px] leading-tight mt-0.5 font-mono">
              {adminUser?.email || 'admin@acuva.com'}
            </p>
          </div>
        </div>
        <button
          onClick={onLogoutAdmin}
          title="Cerrar sesión"
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors shrink-0 active:scale-95"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

