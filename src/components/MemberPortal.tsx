import React, { useState } from 'react';
import { Member, AccessLog } from '../types';
import { VirtualCard } from './VirtualCard';
import { getMembershipTone, formatMoney } from '../lib/status';
import { Button, Input, Field, Alert, Card } from './ui';
import { supabase } from '../lib/supabase';
import isologo from '../assets/isologo.png';
import { LogIn, Sparkles, X } from 'lucide-react';

interface MemberPortalProps {
  members: Member[];
  accessLogs: AccessLog[];
  onNavigateToAdmin: () => void;
  currentUserDni: string | null;
  onSetUserDni: (dni: string | null) => void;
}

function formatAccessDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return `Hoy · ${timeStr}`;
  }

  const day = date.getDate();
  const month = date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toLowerCase();
  return `${day} ${month} · ${timeStr}`;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({
  members,
  accessLogs,
  onNavigateToAdmin: _onNavigateToAdmin,
  currentUserDni,
  onSetUserDni,
}) => {
  const [dniInput, setDniInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estados para personalización / reclamado de cuenta de socio
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>({});
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const currentMember = currentUserDni ? members.find((m) => m.dni === currentUserDni) : null;

  const isClaimed = currentMember
    ? (claimedMap[currentMember.id] !== undefined
        ? claimedMap[currentMember.id]
        : currentMember.is_claimed)
    : true;

  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember) return;

    const trimmedEmail = newEmail.trim();
    const trimmedPassword = newPassword.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setClaimError('Por favor completá todos los campos.');
      return;
    }

    setClaimLoading(true);
    setClaimError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (updateError) {
        throw updateError;
      }

      const { error: rpcError } = await supabase.rpc('claim_member_account', {
        new_email: trimmedEmail,
      });

      if (rpcError) {
        throw rpcError;
      }

      currentMember.is_claimed = true;
      setClaimedMap((prev) => ({ ...prev, [currentMember.id]: true }));
      setIsClaimModalOpen(false);
      setNewEmail('');
      setNewPassword('');
    } catch (err: any) {
      setClaimError(err.message || 'Error al personalizar la cuenta.');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedDni = dniInput.trim();
    const trimmedPass = passwordInput.trim();

    if (!trimmedDni) {
      setErrorMsg('No encontramos un socio con ese DNI. Revisá el número o consultá en recepción.');
      return;
    }

    const member = members.find((m) => m.dni === trimmedDni);
    if (!member) {
      setErrorMsg('No encontramos un socio con ese DNI. Revisá el número o consultá en recepción.');
      return;
    }

    if (trimmedPass && trimmedPass !== trimmedDni) {
      setErrorMsg('La contraseña no coincide. Recordá que es tu número de DNI.');
      return;
    }

    onSetUserDni(member.dni);
  };

  // Sin sesión (login)
  if (!currentMember) {
    return (
      <div className="w-full max-w-[440px] mx-auto px-[18px] pt-7 pb-10 flex flex-col gap-[18px]">
        {/* Cabecera */}
        <div className="flex flex-col gap-2">
          <img
            src={isologo}
            alt="Acuva"
            className="w-[60px] h-[60px] object-contain mb-1"
          />
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-primary leading-tight">
            Tu carnet digital
          </h1>
          <p className="text-[15px] text-text-muted leading-relaxed">
            Ingresá con tu DNI para ver tu QR de acceso y tus últimos ingresos.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && <Alert>{errorMsg}</Alert>}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">
          <Field label="Número de DNI" htmlFor="dni-input">
            <Input
              id="dni-input"
              variant="portal"
              mono
              inputMode="numeric"
              placeholder="43928104"
              value={dniInput}
              onChange={(e) => setDniInput(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Contraseña"
            hint="Es tu mismo DNI"
            htmlFor="password-input"
          >
            <Input
              id="password-input"
              variant="portal"
              type="password"
              placeholder="Repetí tu DNI"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={LogIn}
            className="w-full h-[54px]"
          >
            Ver mi carnet
          </Button>
        </form>

        {/* Pie */}
        <footer className="flex items-center justify-center gap-2 text-xs text-text-faint text-center pt-2">
          <img src={isologo} alt="" className="w-3.5 h-3.5 object-contain" />
          <span>© 2026 Acuva · Sistema de gestión y carnets QR</span>
        </footer>
      </div>
    );
  }

  // Con sesión
  const tone = getMembershipTone(currentMember);
  const myAccessLogs = accessLogs
    .filter((log) => log.dni === currentMember.dni)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div className="w-full max-w-[440px] mx-auto px-[18px] pt-7 pb-10 flex flex-col gap-[18px]">
      {/* Saludo */}
      <div>
        <p className="text-sm text-text-muted">Hola,</p>
        <h1 className="text-[26px] font-extrabold text-text-primary leading-tight">
          {currentMember.nombre}
        </h1>
      </div>

      {/* Banner / Botón de personalización si member.is_claimed === false */}
      {isClaimed === false && (
        <div
          role="region"
          aria-label="Personalización de cuenta"
          className="bg-accent-soft border border-accent-border rounded-2xl p-4 flex flex-col gap-3 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 text-accent flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-text-primary leading-snug">
              Personaliza tu cuenta: agrega tu email y contraseña propios para mayor seguridad y buscar nuevos locales
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setClaimError(null);
              setIsClaimModalOpen(true);
            }}
            className="w-full font-semibold"
          >
            Personalizar cuenta
          </Button>
        </div>
      )}

      {/* Aviso de saldo pendiente */}
      {tone.debt ? (
        <div
          role="status"
          className="bg-status-warn-soft text-status-warn border border-status-warn-border rounded-xl px-4 py-3 text-sm font-medium leading-snug"
        >
          Tenés un saldo pendiente de {formatMoney(tone.debt)}. Acercate a recepción para saldarlo.
        </div>
      ) : null}

      {/* Carnet virtual */}
      <VirtualCard member={currentMember} />

      {/* Últimos ingresos */}
      <Card className="bg-surface-portal">
        <h3 className="text-lg font-bold text-text-primary pb-1">Últimos ingresos</h3>
        {myAccessLogs.length === 0 ? (
          <p className="border-t border-border-subtle pt-3 text-sm text-text-muted">
            Todavía no registraste ingresos.
          </p>
        ) : (
          <div>
            {myAccessLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-t border-border-subtle py-3 text-sm"
              >
                <span className="text-text-secondary">{formatAccessDate(log.timestamp)}</span>
                <span
                  className={
                    log.autorizado
                      ? 'text-status-ok font-semibold'
                      : 'text-status-danger font-semibold'
                  }
                >
                  {log.autorizado ? 'Ingreso' : 'Denegado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pie */}
      <footer className="flex items-center justify-center gap-2 text-xs text-text-faint text-center pt-2">
        <img src={isologo} alt="" className="w-3.5 h-3.5 object-contain" />
        <span>© 2026 Acuva · Sistema de gestión y carnets QR</span>
      </footer>

      {/* Modal de personalización de cuenta */}
      {isClaimModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-overlay backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !claimLoading) {
              setIsClaimModalOpen(false);
              setClaimError(null);
            }
          }}
        >
          <div className="bg-carnet-ground border border-border-default rounded-[20px] w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle bg-carnet-ground shrink-0">
              <div className="flex items-center gap-2.5">
                <img src={isologo} alt="Acuva" className="w-8 h-8 object-contain shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-text-primary">
                    Personalizá tu cuenta
                  </h3>
                  <p className="text-xs text-text-muted">
                    Completá tus credenciales de acceso
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                iconOnly
                icon={X}
                aria-label="Cerrar"
                onClick={() => {
                  if (!claimLoading) {
                    setIsClaimModalOpen(false);
                    setClaimError(null);
                  }
                }}
              />
            </div>

            {/* Form */}
            <form onSubmit={handleClaimAccount} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {claimError && <Alert>{claimError}</Alert>}

              <Field label="Tu correo electrónico real" htmlFor="claim-email">
                <Input
                  id="claim-email"
                  variant="portal"
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={claimLoading}
                />
              </Field>

              <Field label="Tu nueva contraseña" htmlFor="claim-password">
                <Input
                  id="claim-password"
                  variant="portal"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={claimLoading}
                />
              </Field>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={claimLoading}
                  disabled={claimLoading}
                  className="w-full h-[50px] font-semibold"
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setIsClaimModalOpen(false);
                    setClaimError(null);
                  }}
                  disabled={claimLoading}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
