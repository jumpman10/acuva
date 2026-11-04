import React, { useEffect, useState } from 'react';
import { Member, AccessLog, PublicLocal } from '../types';
import { VirtualCard } from './VirtualCard';
import { getMembershipTone, formatMoney } from '../lib/status';
import { fetchMemberAccessLogs } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Button, Input, Field, Alert, Card } from './ui';
import { LocalAvatar, PortalColumn, PortalFooter } from './PortalShell';
import isologo from '../assets/isologo.png';
import { ArrowLeftRight, Sparkles, X } from 'lucide-react';

interface MemberPortalProps {
  member: Member;
  local: PublicLocal;
  /** El socio está en más de un local: muestra "Cambiar de gimnasio". */
  hasOtherLocales: boolean;
  onSwitchLocal: () => void;
  /** Recarga la sesión (después de personalizar la cuenta). */
  onRefresh: () => Promise<unknown>;
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

/** Carnet del socio dentro del portal de un local (/{slug}). */
export const MemberPortal: React.FC<MemberPortalProps> = ({
  member,
  local,
  hasOtherLocales,
  onSwitchLocal,
  onRefresh,
}) => {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Personalización / reclamo de cuenta de socio
  const [isClaimed, setIsClaimed] = useState<boolean>(member.is_claimed !== false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  useEffect(() => {
    setIsClaimed(member.is_claimed !== false);
  }, [member.id, member.is_claimed]);

  useEffect(() => {
    let cancelled = false;
    setLogsLoading(true);
    fetchMemberAccessLogs(member.id, local.id)
      .then((logs) => {
        if (!cancelled) setAccessLogs(logs);
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member.id, local.id]);

  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();

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

      setIsClaimed(true);
      setIsClaimModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      await onRefresh();
    } catch (err: any) {
      setClaimError(err.message || 'Error al personalizar la cuenta.');
    } finally {
      setClaimLoading(false);
    }
  };

  const tone = getMembershipTone(member);

  return (
    <PortalColumn>
      {/* Local + saludo */}
      <div className="flex items-center gap-3">
        <LocalAvatar name={local.name} src={local.avatar_url} className="w-11 h-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-muted truncate">{local.name}</p>
          <h1 className="text-[24px] font-extrabold text-text-primary leading-tight truncate">
            Hola, {member.nombre}
          </h1>
        </div>
        {hasOtherLocales && (
          <Button
            variant="ghost"
            iconOnly
            icon={ArrowLeftRight}
            aria-label="Cambiar de gimnasio"
            title="Cambiar de gimnasio"
            onClick={onSwitchLocal}
          />
        )}
      </div>

      {/* Banner de personalización si la cuenta la creó el local */}
      {!isClaimed && (
        <div
          role="region"
          aria-label="Personalización de cuenta"
          className="bg-accent-soft border border-accent-border rounded-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 text-accent flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-text-primary leading-snug">
              Personalizá tu cuenta: agregá tu email y una contraseña propia para mayor seguridad y
              para sumarte a otros gimnasios.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
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
      <VirtualCard member={member} />

      {/* Últimos ingresos */}
      <Card className="bg-surface-portal">
        <h3 className="text-lg font-bold text-text-primary pb-1">Últimos ingresos</h3>
        {logsLoading ? (
          <p className="border-t border-border-subtle pt-3 text-sm text-text-muted">Cargando...</p>
        ) : accessLogs.length === 0 ? (
          <p className="border-t border-border-subtle pt-3 text-sm text-text-muted">
            Todavía no registraste ingresos.
          </p>
        ) : (
          <div>
            {accessLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-t border-border-subtle py-3 text-sm"
              >
                <span className="text-text-secondary">{formatAccessDate(log.timestamp)}</span>
                <span
                  className={
                    log.autorizado ? 'text-status-ok font-semibold' : 'text-status-danger font-semibold'
                  }
                >
                  {log.autorizado ? 'Ingreso' : 'Denegado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PortalFooter />

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
          <div className="bg-carnet-ground border border-border-default rounded-[20px] w-full max-w-md overflow-hidden relative flex flex-col my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-subtle bg-carnet-ground shrink-0">
              <div className="flex items-center gap-2.5">
                <img src={isologo} alt="Acuva" className="w-8 h-8 object-contain shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-text-primary">Personalizá tu cuenta</h3>
                  <p className="text-xs text-text-muted">Completá tus credenciales de acceso</p>
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
    </PortalColumn>
  );
};
