import React from 'react';
import magologo from '../assets/mago-logo.png';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from './ui';

export interface NavbarProps {
  onNavigate: (path: string) => void;
  /** Hay una sesión abierta (socio o gimnasio). */
  isSignedIn: boolean;
  onLogout: () => void;
  /** Muestra "Ingresar" cuando no hay sesión (landing). */
  showLoginButton?: boolean;
  /** Ancho del contenido: portal (440px) o landing (ancho). */
  wide?: boolean;
  badge?: string;
}

/** Barra superior de las pantallas públicas (landing, login y portal del local). */
export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  isSignedIn,
  onLogout,
  showLoginButton = false,
  wide = false,
  badge,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-bg-base/95 backdrop-blur-md border-b border-border-subtle px-4 sm:px-5 py-3 no-print">
      <div
        className={`w-full mx-auto flex items-center justify-between gap-3 ${
          wide ? 'max-w-5xl' : 'max-w-[440px]'
        }`}
      >
        <button
          type="button"
          onClick={() => onNavigate('/')}
          aria-label="Ir al inicio de Acuva"
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-lg"
        >
          <img
            src={magologo}
            alt="Acuva"
            className="h-7 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          {badge && (
            <span className="text-[10px] font-extrabold tracking-[0.1em] text-accent bg-accent-soft px-2 py-1 rounded-full uppercase leading-none">
              {badge}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Button variant="secondary" icon={LogOut} onClick={onLogout}>
              Salir
            </Button>
          ) : showLoginButton ? (
            <Button variant="secondary" icon={LogIn} onClick={() => onNavigate('/login')}>
              Ingresar
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
