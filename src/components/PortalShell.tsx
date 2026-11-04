import React from 'react';
import isologo from '../assets/isologo.png';
import logo from '../assets/logo.png';

/** Pantalla de carga con la marca. */
export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Cargando...' }) => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="text-center space-y-3">
      <img src={isologo} alt="Acuva" className="w-12 h-12 mx-auto object-contain animate-pulse" />
      <img src={logo} alt="" className="h-5 mx-auto object-contain opacity-80" />
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  </div>
);

/** Pie de las pantallas públicas. */
export const PortalFooter: React.FC = () => (
  <footer className="flex items-center justify-center gap-2 text-xs text-text-faint text-center pt-2">
    <img src={isologo} alt="" className="w-3.5 h-3.5 object-contain" />
    <span>© {new Date().getFullYear()} Acuva · Sistema de gestión y carnets QR</span>
  </footer>
);

/** Contenedor de 440px del portal. */
export const PortalColumn: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`w-full max-w-[440px] mx-auto px-4 sm:px-[18px] pt-7 pb-10 flex flex-col gap-[18px] ${className}`}>
    {children}
  </div>
);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

/** Logo del local, o sus iniciales si no cargó uno. */
export const LocalAvatar: React.FC<{ name: string; src?: string | null; className?: string }> = ({
  name,
  src,
  className = 'w-[60px] h-[60px] text-xl',
}) =>
  src ? (
    <img
      src={src}
      alt={name}
      className={`rounded-2xl object-cover border border-border-default bg-surface-portal shrink-0 ${className}`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`rounded-2xl bg-avatar-bg border border-accent-border text-accent font-extrabold uppercase flex items-center justify-center shrink-0 ${className}`}
    >
      {initialsOf(name) || 'A'}
    </div>
  );
