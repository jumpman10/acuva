import React from 'react';
import { User } from '../../lib/supabase';
import { Users, ScanLine, CreditCard, SlidersHorizontal, LogOut } from 'lucide-react';
import { MemberAvatar, Button } from '../ui';
import magoLogo from '../../assets/mago-logo.png';

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
  const navItems = [
    {
      id: 'members' as const,
      label: 'Socios',
      icon: Users,
      count: membersCount,
      showCount: false,
    },
    {
      id: 'access_logs' as const,
      label: 'Portería',
      icon: ScanLine,
      count: accessLogsCount,
      showCount: false,
    },
    {
      id: 'payment_logs' as const,
      label: 'Pagos',
      icon: CreditCard,
      count: paymentLogsCount,
      showCount: true,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-[248px] shrink-0 h-screen sticky top-0 bg-surface-100 border-r border-border-subtle p-4 text-text-primary z-30 select-none">
      {/* Top Section */}
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center px-2 pt-2">
          <img
            src={magoLogo}
            alt="Acuva"
            className="h-8 object-contain"
          />
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.showCount && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : 'bg-surface-200 text-text-muted'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Configurar */}
          <button
            type="button"
            onClick={onOpenConfigModal}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <SlidersHorizontal size={18} strokeWidth={2} className="shrink-0" />
            <span>Configurar</span>
          </button>
        </nav>
      </div>

      {/* Bottom Profile Card */}
      <div className="pt-4 border-t border-border-subtle flex flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0 px-1">
          <MemberAvatar
            name={adminUser?.email || 'Admin'}
            shape="circle"
            className="w-9 h-9 text-xs"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text-primary truncate">Administrador</p>
            <p className="text-[11px] text-text-muted truncate">
              {adminUser?.email || 'admin@acuva.com'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          icon={LogOut}
          onClick={onLogoutAdmin}
          className="w-full text-xs h-9 justify-start px-2.5 text-text-secondary hover:text-text-primary"
        >
          Salir
        </Button>
      </div>
    </aside>
  );
};
