import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Database, LogOut, QrCode, AlertCircle } from 'lucide-react';
import type { UserContext } from '../lib/authService';
import { getStoredSupabaseConfig } from '../lib/supabase';
import { localDisplayUrl, localPath } from '../lib/routes';
import { LoginForm } from './auth/LoginForm';
import { RegisterLocalForm } from './auth/RegisterLocalForm';
import { Button, Card } from './ui';
import { LocalAvatar, PageLoader, PortalColumn, PortalFooter } from './PortalShell';
import isologo from '../assets/isologo.png';

export type LoginMode = 'login' | 'registro';

export interface LoginPageProps {
  session: UserContext | null;
  initialMode?: LoginMode;
  onAuthenticated: (ctx: UserContext) => void;
  /** Vuelve a leer la sesión de Supabase (después de registrarse). */
  onRefreshSession: () => Promise<UserContext | null>;
  onNavigate: (to: string) => void;
  onLogout: () => void;
  onOpenSupabaseConfig: () => void;
}

/**
 * /login — un solo ingreso para gimnasios y socios.
 * Después de ingresar, App redirige según el rol:
 *   local → /admin · socio con 1 local → /{slug} · socio con varios → lista acá.
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  session,
  initialMode = 'login',
  onAuthenticated,
  onRefreshSession,
  onNavigate,
  onLogout,
  onOpenSupabaseConfig,
}) => {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const { isConfigured } = getStoredSupabaseConfig();
  const hasEnvConfig = Boolean(import.meta.env.VITE_SUPABASE_URL);

  // Socio con sesión: elegir local
  if (session?.role === 'miembro') {
    const locales = session.activeLocales;

    if (locales.length === 1 && locales[0].slug) {
      return <PageLoader label="Abriendo tu carnet..." />;
    }

    const firstName = session.member?.nombre || session.profile.full_name?.split(' ')[0] || '';

    return (
      <PortalColumn>
        <div>
          <p className="text-sm text-text-muted">Hola{firstName ? ',' : ''}</p>
          <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
            {firstName || 'Bienvenido'}
          </h1>
        </div>

        {locales.length === 0 ? (
          <Card className="bg-surface-portal space-y-3">
            <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent-border text-accent flex items-center justify-center">
              <QrCode className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">Todavía no estás en ningún gimnasio</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Escaneá el QR de la recepción de tu gimnasio o entrá al link que te pasaron. Ahí vas a
              poder sumarte y ver tu carnet.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-text-primary">Elegí tu gimnasio</h2>
            {locales.map((loc) => (
              <button
                key={loc.id}
                type="button"
                disabled={!loc.slug}
                onClick={() => loc.slug && onNavigate(localPath(loc.slug))}
                className="w-full flex items-center gap-3 text-left bg-surface-portal border border-border-default rounded-[20px] p-4 hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <LocalAvatar name={loc.name} src={loc.avatar_url} className="w-12 h-12 text-base" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-text-primary truncate">{loc.name}</span>
                  <span className="block text-xs font-mono text-text-muted truncate">
                    {loc.slug ? localDisplayUrl(loc.slug) : 'Sin link configurado'}
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 text-text-muted shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <Button variant="secondary" size="lg" icon={LogOut} onClick={onLogout} className="w-full">
          Cerrar sesión
        </Button>

        <PortalFooter />
      </PortalColumn>
    );
  }

  // Local con sesión: App lo manda a /admin
  if (session?.role === 'local') {
    return <PageLoader label="Abriendo tu panel..." />;
  }

  return (
    <PortalColumn>
      <div className="flex flex-col gap-2">
        <img src={isologo} alt="Acuva" className="w-[60px] h-[60px] object-contain mb-1" />
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary leading-tight">
          {mode === 'login' ? 'Ingresá a Acuva' : 'Registrá tu gimnasio'}
        </h1>
        <p className="text-[15px] text-text-muted leading-relaxed">
          {mode === 'login'
            ? 'Socios y gimnasios ingresan desde acá. Te llevamos a tu carnet o a tu panel.'
            : 'Creá la cuenta y te damos un link y un QR para que tus socios se sumen.'}
        </p>
      </div>

      {!isConfigured && !hasEnvConfig && (
        <div className="p-3.5 rounded-xl bg-status-warn-soft border border-status-warn-border text-status-warn text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Base de datos no configurada</span>
          </div>
          <p className="text-text-secondary text-[11px]">Conectá Supabase para poder ingresar.</p>
          <Button
            type="button"
            variant="secondary"
            icon={Database}
            onClick={onOpenSupabaseConfig}
            className="w-full mt-1"
          >
            Configurar Supabase
          </Button>
        </div>
      )}

      {mode === 'login' ? (
        <LoginForm onSuccess={(result) => onAuthenticated(result)} />
      ) : (
        <RegisterLocalForm
          onRegistered={async () => {
            const ctx = await onRefreshSession();
            if (ctx) onAuthenticated(ctx);
          }}
          onBackToLogin={() => setMode('login')}
        />
      )}

      <div className="pt-3 border-t border-border-subtle text-center">
        {mode === 'login' ? (
          <Button variant="ghost" onClick={() => setMode('registro')} className="text-[13px]">
            ¿Tenés un gimnasio? Creá tu cuenta
          </Button>
        ) : (
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setMode('login')} className="text-[13px]">
            Ya tengo cuenta
          </Button>
        )}
      </div>

      <PortalFooter />
    </PortalColumn>
  );
};
