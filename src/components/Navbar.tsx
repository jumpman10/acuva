import React from 'react';
import { User } from '../lib/supabase';
import magologo from '../assets/mago-logo.png';
import {
  LogOut,
  Shield,
  Settings,
  QrCode
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  adminUser: User | null;
  onLogoutAdmin: () => void;
  onOpenConfigModal: () => void;
  onOpenScanner?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  adminUser,
  onLogoutAdmin,
  onOpenConfigModal,
  onOpenScanner,
}) => {
  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  return (
    <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-[#34d399]/30 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2.5 text-left group"
        >
          <img
            src={magologo}
            alt="Acuva"
            className="w-8 h-8 sm:w-20 sm:h-10 object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs font-mono uppercase px-2 py-0.5 rounded bg-[#0f172a] text-white border border-[#34d399] leading-none">
                {isAdminRoute ? 'ADMIN' : 'CARNET'}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate mt-0.5 hidden xs:block">
              {isAdminRoute ? 'Gestión Administrativa' : 'Portal de Socios'}
            </p>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAdminRoute ? (
            <>
              {/* Tools if admin is authenticated */}
              {adminUser && (
                <>
                  {/* Botón Escanear QR */}
                  {onOpenScanner && (
                    <button
                      onClick={onOpenScanner}
                      className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[#34d399] hover:bg-[#34d399]/90 active:scale-95 text-[#0f172a] rounded-lg border border-[#34d399] flex items-center gap-1.5 text-xs font-mono font-bold transition-all shadow-sm"
                      title="Escanear código QR de socio"
                    >
                      <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="hidden sm:inline">Escanear QR</span>
                    </button>
                  )}

                  {/* Botón Configurar */}
                  <button
                    onClick={onOpenConfigModal}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[#0f172a] hover:bg-[#1e293b] active:scale-95 text-white rounded-lg border border-[#34d399] flex items-center gap-1.5 text-xs font-mono transition-all shadow-sm"
                    title="Configurar disciplinas y cuotas"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar</span>
                  </button>

                  {/* Admin info & Logout */}
                  <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-[#34d399]/40">
                    <div className="hidden md:flex flex-col text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Shield className="w-3 h-3 text-[#34d399]" />
                        <span className="text-[10px] font-mono font-bold text-white uppercase leading-none">
                          Admin
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-300 truncate max-w-[120px]">
                        {adminUser.email}
                      </span>
                    </div>
                    <button
                      onClick={onLogoutAdmin}
                      title="Cerrar sesión de administrador"
                      className="px-2.5 py-1.5 bg-[#0f172a] hover:bg-[#1e293b] active:scale-95 text-white rounded-lg border border-[#34d399] flex items-center gap-1.5 text-xs font-mono transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Salir</span>
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Common user view on / */
            <>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
