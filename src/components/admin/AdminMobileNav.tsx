import React from 'react';
import { User } from '../../lib/supabase';
import { Users, History, CreditCard, SlidersHorizontal, QrCode, LogOut } from 'lucide-react';

export interface AdminMobileHeaderProps {
  adminUser?: User | null;
  onLogoutAdmin: () => void;
}

export const AdminMobileHeader: React.FC<AdminMobileHeaderProps> = ({
  onLogoutAdmin,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#080c14]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between lg:hidden select-none">
      {/* Brand mark + Acuva + ADMIN pill */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#34d399] flex items-center justify-center text-[#080c14] shadow-sm shrink-0">
          <QrCode className="w-5 h-5 stroke-[2.5]" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Acuva</span>
        <span className="bg-[#34d399] text-[#080c14] font-black text-[10px] px-2 py-0.5 rounded-full tracking-wider uppercase leading-none ml-1">
          ADMIN
        </span>
      </div>

      {/* Logout circular button */}
      <button
        onClick={onLogoutAdmin}
        title="Cerrar sesión"
        className="w-10 h-10 rounded-full bg-[#101726] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all shadow-sm"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </header>
  );
};

export interface AdminMobileBottomNavProps {
  activeTab: 'members' | 'access_logs' | 'payment_logs';
  onTabChange: (tab: 'members' | 'access_logs' | 'payment_logs') => void;
  onOpenScanner: () => void;
  onOpenConfigModal: () => void;
}

export const AdminMobileBottomNav: React.FC<AdminMobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
  onOpenConfigModal,
}) => {
  return (
    <nav className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto lg:hidden select-none">
      <div className="bg-[#0e1626]/95 backdrop-blur-lg border border-slate-800 rounded-2xl px-2 py-1.5 shadow-2xl flex items-center justify-around relative">
        {/* 1. Socios */}
        <button
          onClick={() => onTabChange('members')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'members' ? 'text-[#34d399]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Socios</span>
        </button>

        {/* 2. Portería */}
        <button
          onClick={() => onTabChange('access_logs')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'access_logs' ? 'text-[#34d399]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Portería</span>
        </button>

        {/* 3. Center FAB (Escanear QR) */}
        <div className="flex items-center justify-center flex-1 relative">
          <button
            onClick={onOpenScanner}
            title="Escanear QR Portería"
            className="-mt-6 w-[52px] h-[52px] rounded-full bg-[#34d399] hover:bg-[#34d399]/90 text-[#080c14] border-4 border-[#0b111e] flex items-center justify-center shadow-lg shadow-[#34d399]/30 active:scale-90 transition-all shrink-0"
          >
            <QrCode className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Pagos */}
        <button
          onClick={() => onTabChange('payment_logs')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'payment_logs' ? 'text-[#34d399]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Pagos</span>
        </button>

        {/* 5. Ajustes */}
        <button
          onClick={onOpenConfigModal}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};

