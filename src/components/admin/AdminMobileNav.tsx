import React from 'react';
import { User } from '../../lib/supabase';
import { Users, ScanLine, CreditCard, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui';
import magoLogo from '../../assets/mago-logo.png';

export interface AdminMobileHeaderProps {
  adminUser?: User | null;
  onLogoutAdmin?: () => void;
  onOpenScanner?: () => void;
}

export const AdminMobileHeader: React.FC<AdminMobileHeaderProps> = ({
  onOpenScanner,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-surface-100/95 backdrop-blur-md border-b border-border-subtle px-4 py-3 flex items-center justify-between lg:hidden select-none">
      <img
        src={magoLogo}
        alt="Acuva"
        className="h-7 object-contain"
      />

      {onOpenScanner && (
        <Button
          variant="primary"
          iconOnly
          icon={ScanLine}
          aria-label="Escanear QR"
          onClick={onOpenScanner}
        />
      )}
    </header>
  );
};

export interface AdminMobileBottomNavProps {
  activeTab: 'members' | 'access_logs' | 'payment_logs';
  onTabChange: (tab: 'members' | 'access_logs' | 'payment_logs') => void;
  onOpenScanner?: () => void;
  onOpenConfigModal: () => void;
}

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenConfigModal,
}) => {
  const items = [
    {
      id: 'members' as const,
      label: 'Socios',
      icon: Users,
      onClick: () => onTabChange('members'),
      isActive: activeTab === 'members',
    },
    {
      id: 'access_logs' as const,
      label: 'Portería',
      icon: ScanLine,
      onClick: () => onTabChange('access_logs'),
      isActive: activeTab === 'access_logs',
    },
    {
      id: 'payment_logs' as const,
      label: 'Pagos',
      icon: CreditCard,
      onClick: () => onTabChange('payment_logs'),
      isActive: activeTab === 'payment_logs',
    },
    {
      id: 'config' as const,
      label: 'Configurar',
      icon: SlidersHorizontal,
      onClick: onOpenConfigModal,
      isActive: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-100 border-t border-border-subtle pb-[env(safe-area-inset-bottom)] lg:hidden select-none">
      <div className="flex items-center justify-around px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center flex-1 py-1 gap-1 text-[11px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-lg ${
                item.isActive
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={18} strokeWidth={item.isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
