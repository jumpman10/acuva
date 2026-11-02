import React from 'react';
import { User } from '../lib/supabase';
import magologo from '../assets/mago-logo.png';
import {
  LogOut,
  Shield,
  Settings,
  QrCode
} from 'lucide-react';
import { Button } from './ui';

export interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  adminUser: User | null;
  onLogoutAdmin: () => void;
  onOpenConfigModal: () => void;
  onOpenScanner?: () => void;
  currentUserDni?: string | null;
  onLogoutMember?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  adminUser,
  onLogoutAdmin,
  onOpenConfigModal,
  onOpenScanner,
  currentUserDni,
  onLogoutMember,
}) => {
  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  return (
    <header className="sticky top-0 z-40 bg-bg-base/95 backdrop-blur-md border-b border-border-subtle px-5 py-3 transition-colors">
      <div
        className={`w-full mx-auto flex items-center justify-between gap-3 ${
          isAdminRoute ? 'max-w-7xl' : 'max-w-[440px]'
        }`}
      >
        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-lg"
        >
          <img
            src={magologo}
            alt="Acuva"
            className="h-7 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          <span
            className={
              isAdminRoute
                ? 'text-[10px] font-extrabold tracking-[0.1em] text-text-primary bg-surface-200 border border-border-default px-2 py-1 rounded-full uppercase leading-none'
                : 'text-[10px] font-extrabold tracking-[0.1em] text-accent bg-accent-soft px-2 py-1 rounded-full uppercase leading-none'
            }
          >
            {isAdminRoute ? 'ADMIN' : 'CARNET'}
          </span>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAdminRoute ? (
            <>
              {adminUser && (
                <>
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      aria-label="Escanear código QR"
                      className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-accent hover:bg-accent-hover text-ink-on-accent rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      title="Escanear código QR de socio"
                    >
                      <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="hidden sm:inline">Escanear QR</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onOpenConfigModal}
                    aria-label="Configurar disciplinas"
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-bg-base hover:bg-surface-hover text-text-primary rounded-lg border border-border-default flex items-center gap-1.5 text-xs transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    title="Configurar disciplinas y cuotas"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar</span>
                  </button>

                  <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-border-subtle">
                    <div className="hidden md:flex flex-col text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Shield className="w-3 h-3 text-accent" />
                        <span className="text-[10px] font-bold text-text-primary leading-none">
                          Admin
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted truncate max-w-[120px]">
                        {adminUser.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onLogoutAdmin}
                      aria-label="Cerrar sesión"
                      title="Cerrar sesión de administrador"
                      className="px-2.5 py-1.5 bg-bg-base hover:bg-surface-hover text-text-primary rounded-lg border border-border-default flex items-center gap-1.5 text-xs transition-all focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Salir</span>
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            currentUserDni && onLogoutMember ? (
              <Button
                variant="secondary"
                icon={LogOut}
                onClick={onLogoutMember}
              >
                Salir
              </Button>
            ) : null
          )}
        </div>
      </div>
    </header>
  );
};
