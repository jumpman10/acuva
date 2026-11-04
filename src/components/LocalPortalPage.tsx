import React, { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, MapPinOff, UserPlus, Users } from 'lucide-react';
import type { PublicLocal } from '../types';
import { getLocalBySlug, joinLocal, authErrorMessage, type UserContext } from '../lib/authService';
import { LoginForm } from './auth/LoginForm';
import { RegisterMemberForm } from './auth/RegisterMemberForm';
import { MemberPortal } from './MemberPortal';
import { Alert, Button, Card } from './ui';
import { LocalAvatar, PageLoader, PortalColumn, PortalFooter } from './PortalShell';

export interface LocalPortalPageProps {
  slug: string;
  session: UserContext | null;
  onAuthenticated: (ctx: UserContext) => void;
  /** Vuelve a leer la sesión de Supabase y la actualiza en App. */
  onRefreshSession: () => Promise<UserContext | null>;
  onNavigate: (to: string) => void;
  onLogout: () => void;
}

type Tab = 'login' | 'registro';

/**
 * /{slug} — portal de socios de un local.
 * Sin sesión: ingreso o alta con la marca del local.
 * Socio vinculado: su carnet. Socio no vinculado: puede sumarse si hay cupo.
 */
export const LocalPortalPage: React.FC<LocalPortalPageProps> = ({
  slug,
  session,
  onAuthenticated,
  onRefreshSession,
  onNavigate,
  onLogout,
}) => {
  const [local, setLocal] = useState<PublicLocal | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('login');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadLocal = async () => {
    setLoadError(null);
    try {
      setLocal(await getLocalBySlug(slug));
    } catch (err) {
      setLocal(undefined);
      setLoadError(authErrorMessage(err, 'No pudimos cargar el gimnasio.'));
    }
  };

  useEffect(() => {
    setLocal(undefined);
    setTab('login');
    setJoinError(null);
    loadLocal();
  }, [slug]);

  const handleJoin = async () => {
    if (!local) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinLocal(local.slug);
      await onRefreshSession();
    } catch (err) {
      setJoinError(authErrorMessage(err, 'No pudimos sumarte a este gimnasio.'));
      // La cuenta pudo quedar creada (registro) y el cupo pudo cambiar
      await onRefreshSession();
      loadLocal();
    } finally {
      setJoining(false);
    }
  };

  if (loadError) {
    return (
      <PortalColumn>
        <Alert>{loadError}</Alert>
        <Button variant="secondary" size="lg" onClick={loadLocal} className="w-full">
          Reintentar
        </Button>
      </PortalColumn>
    );
  }

  if (local === undefined) {
    return <PageLoader />;
  }

  if (local === null) {
    return (
      <PortalColumn>
        <Card className="bg-surface-portal space-y-3 text-center py-8">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-200 border border-border-default text-text-muted flex items-center justify-center">
            <MapPinOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-extrabold text-text-primary">No encontramos este gimnasio</h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Revisá que el link esté bien escrito o pedile el QR a la recepción de tu gimnasio.
          </p>
        </Card>
        <Button variant="secondary" size="lg" onClick={() => onNavigate('/login')} className="w-full">
          Ir a ingresar
        </Button>
        <PortalFooter />
      </PortalColumn>
    );
  }

  const header = (
    <div className="flex flex-col gap-2">
      <LocalAvatar name={local.name} src={local.avatar_url} className="w-[60px] h-[60px] text-xl mb-1" />
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-accent">Portal de socios</p>
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary leading-tight">
        {local.name}
      </h1>
    </div>
  );

  // Cuenta de gimnasio mirando un portal
  if (session?.role === 'local') {
    const isOwnLocal = session.local && String(session.local.id) === local.id;
    return (
      <PortalColumn>
        {header}
        <Card className="bg-surface-portal space-y-3">
          <p className="text-sm text-text-secondary leading-relaxed">
            {isOwnLocal
              ? 'Así ven tus socios esta página. Para ver tu carnet de socio, ingresá con una cuenta de socio.'
              : 'Ingresaste con la cuenta de un gimnasio. Para sumarte como socio, ingresá con una cuenta de socio.'}
          </p>
          <div className="flex flex-col gap-2">
            {isOwnLocal && (
              <Button variant="primary" size="lg" icon={LayoutDashboard} onClick={() => onNavigate('/admin')} className="w-full">
                Ir a mi panel
              </Button>
            )}
            <Button variant="secondary" size="lg" icon={LogOut} onClick={onLogout} className="w-full">
              Cerrar sesión
            </Button>
          </div>
        </Card>
        <PortalFooter />
      </PortalColumn>
    );
  }

  // Socio con sesión
  if (session?.role === 'miembro') {
    const isLinked = session.activeLocales.some((l) => String(l.id) === local.id);

    if (isLinked && session.member) {
      return (
        <MemberPortal
          member={session.member}
          local={local}
          hasOtherLocales={session.activeLocales.length > 1}
          onSwitchLocal={() => onNavigate('/login')}
          onRefresh={onRefreshSession}
        />
      );
    }

    const firstName = session.member?.nombre || session.profile.full_name?.split(' ')[0] || '';

    return (
      <PortalColumn>
        {header}
        <Card className="bg-surface-portal space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-text-primary">
              {firstName ? `${firstName}, todavía` : 'Todavía'} no sos socio de {local.name}
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              {local.is_full
                ? 'Este gimnasio alcanzó el cupo de socios de su plan. Consultá en recepción.'
                : 'Sumate para tener tu carnet digital de este gimnasio. Tu pago lo registra la recepción.'}
            </p>
          </div>

          {joinError && <Alert>{joinError}</Alert>}

          {!local.is_full && (
            <Button
              variant="primary"
              size="lg"
              icon={UserPlus}
              loading={joining}
              onClick={handleJoin}
              className="w-full h-[54px]"
            >
              Sumarme a {local.name}
            </Button>
          )}
        </Card>

        <div className="flex flex-col gap-2">
          {session.activeLocales.length > 0 && (
            <Button variant="secondary" size="lg" icon={Users} onClick={() => onNavigate('/login')} className="w-full">
              Ver mis gimnasios
            </Button>
          )}
          <Button variant="ghost" icon={LogOut} onClick={onLogout} className="w-full">
            Cerrar sesión
          </Button>
        </div>

        <PortalFooter />
      </PortalColumn>
    );
  }

  // Sin sesión
  return (
    <PortalColumn>
      {header}

      <div role="tablist" aria-label="Ingreso o alta" className="grid grid-cols-2 gap-1 p-1 bg-surface-portal border border-border-default rounded-[14px]">
        {(
          [
            { id: 'login', label: 'Ingresar' },
            { id: 'registro', label: 'Crear cuenta' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-11 rounded-[10px] text-sm font-bold transition-colors cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              tab === t.id ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'login' ? (
        <>
          <p className="text-[15px] text-text-muted leading-relaxed -mt-1">
            Ingresá para ver tu QR de acceso y tus últimos ingresos.
          </p>
          <LoginForm submitLabel="Ver mi carnet" onSuccess={(result) => onAuthenticated(result)} />
        </>
      ) : local.is_full ? (
        <div
          role="status"
          className="bg-status-warn-soft text-status-warn border border-status-warn-border rounded-xl px-4 py-3 text-sm font-medium leading-snug"
        >
          {local.name} alcanzó el cupo de socios de su plan, así que por ahora no se pueden crear
          cuentas nuevas. Consultá en recepción.
        </div>
      ) : (
        <>
          <p className="text-[15px] text-text-muted leading-relaxed -mt-1">
            Creá tu cuenta y quedás sumado a {local.name}. Tu pago lo registra la recepción.
          </p>
          {joinError && <Alert>{joinError}</Alert>}
          <RegisterMemberForm
            localName={local.name}
            onRegistered={async () => {
              await handleJoin();
            }}
          />
        </>
      )}

      <PortalFooter />
    </PortalColumn>
  );
};
