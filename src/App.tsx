import React, { useState, useEffect } from 'react';
import { Member, AccessLog, PaymentLog, DisciplineItem, RenewMemberOptions } from './types';
import {
  fetchMembers,
  createMember,
  updateMember,
  deleteMember,
  renewMemberMembership,
  logAccess,
  getAccessLogs,
  fetchAccessLogs,
  getPaymentLogs,
  fetchPaymentLogs,
  fetchDisciplines,
} from './lib/storage';
import { getStoredSupabaseConfig, getSupabase, signOutAdmin, User } from './lib/supabase';
import { getDaysRemaining } from './lib/dateUtils';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSidebar } from './components/admin/AdminSidebar';
import { AdminMobileHeader, AdminMobileBottomNav } from './components/admin/AdminMobileNav';
import { AdminLoginPage } from './components/AdminLoginPage';
import { MemberPortal } from './components/MemberPortal';
import { MemberModal } from './components/MemberModal';
import { QrScannerModal } from './components/QrScannerModal';
import { ExpiringListModal } from './components/ExpiringListModal';
import { VirtualCardModal } from './components/VirtualCardModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { DisciplineConfigModal } from './components/DisciplineConfigModal';
import isologo from './assets/isologo.png';
import logo from './assets/logo.png';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for Admin
  const [adminTab, setAdminTab] = useState<'members' | 'access_logs' | 'payment_logs'>('members');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCardMember, setSelectedCardMember] = useState<Member | null>(null);

  // User role state (regular members on /)
  const [currentUserDni, setCurrentUserDni] = useState<string | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);

  // Router listener for HTML5 history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
      setCurrentPath(to);
      window.scrollTo(0, 0);
    }
  };

  // Load initial data
  const loadData = async () => {
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

      const config = getStoredSupabaseConfig();
      setSupabaseConfigured(config.isConfigured);
    } catch (err) {
      console.error('Error loading data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Initialize Supabase Auth state listener
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setAdminUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setAdminUser(session?.user ?? null);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Handlers
  const handleSaveMember = async (data: any) => {
    if (editingMember) {
      await updateMember(editingMember.id, data);
    } else {
      await createMember(data);
    }
    await loadData();
    setIsMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    await deleteMember(id);
    await loadData();
  };

  const handleRenewMember = async (id: string, options?: RenewMemberOptions) => {
    await renewMemberMembership(id, options);
    await loadData();
  };

  const handleLogAccess = async (logData: Omit<AccessLog, 'id' | 'timestamp'>) => {
    await logAccess(logData);
    setAccessLogs(getAccessLogs());
  };

  const handleLogoutAdmin = async () => {
    await signOutAdmin();
    setAdminUser(null);
  };

  // Count members expiring in <= 2 days
  const expiringCount = members.filter((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    return days >= 0 && days <= 2 && m.estado_pago === 'pagado';
  }).length;

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  // If authenticated admin on admin route, render modern Phase 1 Admin Layout
  if (isAdminRoute && adminUser) {
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
          adminUser={adminUser}
          onLogoutAdmin={handleLogoutAdmin}
        />

        {/* Content Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-bg-deep">
          {/* Mobile Header (< lg) */}
          <AdminMobileHeader
            adminUser={adminUser}
            onLogoutAdmin={handleLogoutAdmin}
            onOpenScanner={() => setIsScannerOpen(true)}
          />

          {/* Main scrollable content area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
            {loading ? (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center space-y-3">
                  <img
                    src={isologo}
                    alt="Acuva"
                    className="w-12 h-12 mx-auto object-contain animate-pulse"
                  />
                  <img
                    src={logo}
                    alt="Acuva"
                    className="h-5 mx-auto object-contain opacity-80"
                  />
                  <p className="text-xs text-text-muted">Cargando...</p>
                </div>
              </div>
            ) : (
              <AdminDashboard
                members={members}
                accessLogs={accessLogs}
                paymentLogs={paymentLogs}
                disciplines={disciplines}
                activeTab={adminTab}
                onTabChange={setAdminTab}
                onOpenNewMember={() => {
                  setEditingMember(null);
                  setIsMemberModalOpen(true);
                }}
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

        <SupabaseConfigModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onConfigSaved={() => {
            loadData();
            setIsSupabaseModalOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col selection:bg-accent selection:text-ink-on-accent antialiased">
      {/* Top Navbar */}
      <Navbar
        currentPath={currentPath}
        onNavigate={navigate}
        adminUser={adminUser}
        onLogoutAdmin={handleLogoutAdmin}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        currentUserDni={currentUserDni}
        onLogoutMember={() => setCurrentUserDni(null)}
      />

      {/* Main Body */}
      <main className={isAdminRoute ? 'flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-6' : 'flex-1 w-full'}>
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center space-y-3">
              <img
                src={isologo}
                alt="Acuva"
                className="w-12 h-12 mx-auto object-contain animate-pulse"
              />
              <img
                src={logo}
                alt="Acuva"
                className="h-5 mx-auto object-contain opacity-80"
              />
              <p className="text-xs text-text-muted">Cargando...</p>
            </div>
          </div>
        ) : isAdminRoute ? (
          /* Route /admin when not logged in */
          <AdminLoginPage
            onLoginSuccess={(user) => setAdminUser(user)}
            onNavigateHome={() => navigate('/')}
            onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
          />
        ) : (
          /* Route / for common user */
          <MemberPortal
            members={members}
            accessLogs={accessLogs}
            onNavigateToAdmin={() => navigate('/admin')}
            currentUserDni={currentUserDni}
            onSetUserDni={(dni) => setCurrentUserDni(dni)}
          />
        )}
      </main>

      {/* Footer (solo para rutas admin fuera de sesión, el portal de socios tiene su propio pie) */}
      {isAdminRoute && (
        <footer className="border-t border-border-subtle bg-bg-base py-4 text-center text-xs text-text-muted no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              <img src={isologo} alt="Acuva" className="w-4 h-4 object-contain" />
              <span>&copy; {new Date().getFullYear()} Acuva • Sistema de Gestión y Carnets QR</span>
            </div>
          </div>
        </footer>
      )}

      {/* Supabase Configuration Modal */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigSaved={() => {
          loadData();
          setIsSupabaseModalOpen(false);
        }}
      />
    </div>
  );
}
