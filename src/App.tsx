import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Member, AccessLog, PaymentLog, DisciplineItem, RenewMemberOptions, Local } from './types';
import {
  fetchMembers,
  createMember,
  updateMember,
  deleteMember,
  renewMemberMembership,
  logAccess,
  fetchAccessLogs,
  fetchPaymentLogs,
  fetchDisciplines,
  setActiveLocalId,
  clearCachedData,
} from './lib/storage';
import { getSupabase } from './lib/supabase';
import {
  getCurrentLocal,
  getSessionContext,
  isLocalFull,
  logout,
  authErrorMessage,
  type UserContext,
} from './lib/authService';
import { parseRoute, localPath } from './lib/routes';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSidebar } from './components/admin/AdminSidebar';
import { AdminMobileHeader, AdminMobileBottomNav } from './components/admin/AdminMobileNav';
import { LocalLinkCard } from './components/admin/LocalLinkCard';
import { LandingPage } from './components/LandingPage';
import { LoginPage, type LoginMode } from './components/LoginPage';
import { LocalPortalPage } from './components/LocalPortalPage';
import { PageLoader, PortalColumn } from './components/PortalShell';
import { MemberModal } from './components/MemberModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ExpiringListModal } from './components/ExpiringListModal';
import { VirtualCardModal } from './components/VirtualCardModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { DisciplineConfigModal } from './components/DisciplineConfigModal';
import { Alert, Button, Card } from './components/ui';
import { MapPinOff, X } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const route = parseRoute(currentPath);

  // Sesión única (local o socio)
  const [session, setSession] = useState<UserContext | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const sessionRef = useRef<UserContext | null>(null);
  sessionRef.current = session;

  // Datos del panel del local
  const [currentLocal, setCurrentLocal] = useState<Local | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [cupoNotice, setCupoNotice] = useState<string | null>(null);

  // Modals for Admin
  const [adminTab, setAdminTab] = useState<'members' | 'access_logs' | 'payment_logs'>('members');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCardMember, setSelectedCardMember] = useState<Member | null>(null);

  // ------------------------------------------------------------------
  // Router (history API)
  // ------------------------------------------------------------------
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    const target = new URL(to, window.location.origin);
    const current = window.location.pathname + window.location.search;
    if (current === target.pathname + target.search) return;
    if (options?.replace) {
      window.history.replaceState({}, '', target.pathname + target.search);
    } else {
      window.history.pushState({}, '', target.pathname + target.search);
    }
    setCurrentPath(target.pathname);
    window.scrollTo(0, 0);
  }, []);

  // ------------------------------------------------------------------
  // Sesión
  // ------------------------------------------------------------------
  const refreshSession = useCallback(async (): Promise<UserContext | null> => {
    try {
      const ctx = await getSessionContext();
      setSession(ctx);
      return ctx;
    } catch (err) {
      console.error('Error al restaurar la sesión', err);
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setSessionReady(true));

    const supabase = getSupabase();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        return;
      }
      // No se hacen consultas dentro del callback (puede trabar supabase-js)
      const isNewUser = authSession?.user && sessionRef.current?.user.id !== authSession.user.id;
      if (event === 'USER_UPDATED' || (event === 'SIGNED_IN' && isNewUser)) {
        window.setTimeout(() => {
          refreshSession();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshSession]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Error al cerrar sesión', err);
    }
    clearCachedData();
    setActiveLocalId(null);
    setSession(null);
    setCurrentLocal(null);
    setMembers([]);
    setAccessLogs([]);
    setPaymentLogs([]);
    if (parseRoute(window.location.pathname).name === 'admin') {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // ------------------------------------------------------------------
  // Redirecciones según rol
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!sessionReady) return;

    if (route.name === 'admin' && session?.role !== 'local') {
      navigate('/login', { replace: true });
      return;
    }

    if (route.name === 'login' && session?.role === 'local') {
      navigate('/admin', { replace: true });
      return;
    }

    if (route.name === 'login' && session?.role === 'miembro') {
      const only = session.activeLocales.length === 1 ? session.activeLocales[0] : null;
      if (only?.slug) {
        navigate(localPath(only.slug), { replace: true });
      }
    }
  }, [sessionReady, session, route.name, navigate]);

  // ------------------------------------------------------------------
  // Datos del local
  // ------------------------------------------------------------------
  const isLocalSession = session?.role === 'local';

  const loadData = useCallback(async () => {
    try {
      const [mems, accs, pays, discs] = await Promise.all([
        fetchMembers(),
        fetchAccessLogs(),
        fetchPaymentLogs(),
        fetchDisciplines(),
      ]);
      setMembers(mems);
      setAccessLogs(accs);
      setPaymentLogs(pays);
      setDisciplines(discs);
      setDataError(null);
    } catch (err) {
      console.error('Error loading data', err);
      setDataError(authErrorMessage(err, 'No pudimos cargar los datos de tu gimnasio.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshLocal = useCallback(async () => {
    const loc = await getCurrentLocal();
    if (loc) setCurrentLocal(loc);
    return loc;
  }, []);

  useEffect(() => {
    if (!isLocalSession || !session) {
      setActiveLocalId(null);
      setCurrentLocal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const loc = session.local ?? (await getCurrentLocal());
      if (cancelled) return;
      setCurrentLocal(loc);
      setActiveLocalId(loc ? String(loc.id) : null);
      if (!loc) {
        setDataError('No encontramos el gimnasio de esta cuenta. Escribinos para revisarlo.');
        setLoading(false);
        return;
      }
      await loadData();
    })();

    return () => {
      cancelled = true;
    };
  }, [isLocalSession, session?.user.id, loadData]);

  // Handlers
  const handleOpenNewMember = () => {
    if (isLocalFull(currentLocal)) {
      setCupoNotice(
        `Llegaste al cupo de ${currentLocal?.max_members} socios de tu plan. Para sumar más socios, ampliá tu plan.`
      );
      return;
    }
    setCupoNotice(null);
    setEditingMember(null);
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (data: any) => {
    try {
      if (editingMember) {
        await updateMember(editingMember.id, data);
      } else {
        // La cuenta y el vínculo ya los creó el alta (MemberModal → registerMemberByLocal)
        await createMember(data);
      }
    } catch (err) {
      await Promise.all([loadData(), refreshLocal()]);
      throw new Error(authErrorMessage(err, 'No se pudo guardar el socio.'));
    }
    await Promise.all([loadData(), refreshLocal()]);
    setIsMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    await deleteMember(id);
    await Promise.all([loadData(), refreshLocal()]);
  };

  const handleRenewMember = async (id: string, options?: RenewMemberOptions) => {
    await renewMemberMembership(id, options);
    await loadData();
  };

  const handleLogAccess = async (logData: Omit<AccessLog, 'id' | 'timestamp'>) => {
    try {
      const saved = await logAccess(logData);
      setAccessLogs((prev) => [saved, ...prev]);
    } catch (err) {
      console.error('No se pudo registrar el acceso', err);
      setDataError(authErrorMessage(err, 'No se pudo registrar el ingreso.'));
    }
  };

  const supabaseModal = (
    <SupabaseConfigModal
      isOpen={isSupabaseModalOpen}
      onClose={() => setIsSupabaseModalOpen(false)}
      onConfigSaved={() => {
        setIsSupabaseModalOpen(false);
        window.location.reload();
      }}
    />
  );

  // ------------------------------------------------------------------
  // /admin — panel del local
  // ------------------------------------------------------------------
  if (route.name === 'admin') {
    if (!sessionReady || !isLocalSession || !session) {
      return (
        <div className="min-h-screen bg-bg-deep text-text-primary antialiased">
          <PageLoader />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-bg-deep text-text-primary flex flex-col lg:flex-row antialiased selection:bg-accent selection:text-ink-on-accent">
        {/* Desktop Sidebar (hidden lg:flex) */}
        <AdminSidebar
          activeTab={adminTab}
          onTabChange={setAdminTab}
          membersCount={members.length}
          accessLogsCount={accessLogs.length}
          paymentLogsCount={paymentLogs.length}
          onOpenConfigModal={() => setIsConfigModalOpen(true)}
          adminUser={session.user}
          onLogoutAdmin={handleLogout}
        />

        {/* Content Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-bg-deep">
          {/* Mobile Header (< lg) */}
          <AdminMobileHeader
            adminUser={session.user}
            onLogoutAdmin={handleLogout}
            onOpenScanner={() => setIsScannerOpen(true)}
          />

          {/* Main scrollable content area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
            {loading ? (
              <PageLoader />
            ) : (
              <>
                {currentLocal && (
                  <LocalLinkCard local={currentLocal} onLocalUpdated={setCurrentLocal} />
                )}

                {dataError && (
                  <Alert className="mb-4">
                    <div className="flex items-start justify-between gap-3">
                      <span>{dataError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDataError(null);
                          loadData();
                        }}
                        className="shrink-0 underline font-semibold cursor-pointer rounded focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Reintentar
                      </button>
                    </div>
                  </Alert>
                )}

                {cupoNotice && (
                  <Alert className="mb-4">
                    <div className="flex items-start justify-between gap-3">
                      <span>{cupoNotice}</span>
                      <button
                        type="button"
                        aria-label="Cerrar aviso"
                        onClick={() => setCupoNotice(null)}
                        className="shrink-0 cursor-pointer rounded focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </Alert>
                )}

                <AdminDashboard
                  members={members}
                  accessLogs={accessLogs}
                  paymentLogs={paymentLogs}
                  disciplines={disciplines}
                  activeTab={adminTab}
                  onTabChange={setAdminTab}
                  onOpenNewMember={handleOpenNewMember}
                  onOpenEditMember={(m) => {
                    setEditingMember(m);
                    setIsMemberModalOpen(true);
                  }}
                  onDeleteMember={handleDeleteMember}
                  onRenewMember={handleRenewMember}
                  onOpenScanner={() => setIsScannerOpen(true)}
                  onOpenExpiringModal={() => setIsExpiringModalOpen(true)}
                  onOpenCardModal={(m) => setSelectedCardMember(m)}
                />
              </>
            )}
          </main>

          {/* Mobile Bottom Nav (< lg) */}
          <AdminMobileBottomNav
            activeTab={adminTab}
            onTabChange={setAdminTab}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenConfigModal={() => setIsConfigModalOpen(true)}
          />
        </div>

        {/* ADMIN MODALS */}
        <MemberModal
          isOpen={isMemberModalOpen}
          onClose={() => {
            setIsMemberModalOpen(false);
            setEditingMember(null);
          }}
          onSave={handleSaveMember}
          member={editingMember}
          disciplines={disciplines}
          onDelete={handleDeleteMember}
          currentLocal={currentLocal}
        />

        <QrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          members={members}
          onLogAccess={handleLogAccess}
          onRenewMember={handleRenewMember}
        />

        <ExpiringListModal
          isOpen={isExpiringModalOpen}
          onClose={() => setIsExpiringModalOpen(false)}
          members={members}
        />

        <VirtualCardModal
          isOpen={Boolean(selectedCardMember)}
          onClose={() => setSelectedCardMember(null)}
          member={selectedCardMember}
        />

        <DisciplineConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          disciplines={disciplines}
          onDisciplinesChange={async () => {
            const updated = await fetchDisciplines();
            setDisciplines(updated);
          }}
        />

        {supabaseModal}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Pantallas públicas: landing, /login y /{slug}
  // ------------------------------------------------------------------
  const loginMode: LoginMode =
    new URLSearchParams(window.location.search).get('modo') === 'registro' ? 'registro' : 'login';

  let content: React.ReactNode;

  if (route.name === 'landing') {
    content = <LandingPage onNavigate={navigate} />;
  } else if (!sessionReady) {
    content = <PageLoader />;
  } else if (route.name === 'login') {
    content = (
      <LoginPage
        key={loginMode}
        session={session}
        initialMode={loginMode}
        onAuthenticated={setSession}
        onRefreshSession={refreshSession}
        onNavigate={navigate}
        onLogout={handleLogout}
        onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
      />
    );
  } else if (route.name === 'local') {
    content = (
      <LocalPortalPage
        slug={route.slug}
        session={session}
        onAuthenticated={setSession}
        onRefreshSession={refreshSession}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  } else {
    content = (
      <PortalColumn>
        <Card className="bg-surface-portal space-y-3 text-center py-8">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-200 border border-border-default text-text-muted flex items-center justify-center">
            <MapPinOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-extrabold text-text-primary">No encontramos esta página</h1>
          <p className="text-sm text-text-muted">Revisá el link o volvé al inicio.</p>
        </Card>
        <Button variant="secondary" size="lg" onClick={() => navigate('/')} className="w-full">
          Ir al inicio
        </Button>
      </PortalColumn>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col selection:bg-accent selection:text-ink-on-accent antialiased">
      <Navbar
        onNavigate={navigate}
        isSignedIn={Boolean(session) && route.name !== 'landing'}
        onLogout={handleLogout}
        showLoginButton={route.name === 'landing'}
        wide={route.name === 'landing'}
        badge={route.name === 'local' ? 'Carnet' : undefined}
      />

      <main className="flex-1 w-full">{content}</main>

      {supabaseModal}
    </div>
  );
}
