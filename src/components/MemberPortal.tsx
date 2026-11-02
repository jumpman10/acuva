import React, { useState } from 'react';
import { Member, AccessLog } from '../types';
import { VirtualCard } from './VirtualCard';
import { getMembershipTone, formatMoney } from '../lib/status';
import { Button, Input, Field, Alert, Card } from './ui';
import isologo from '../assets/isologo.png';
import { LogIn } from 'lucide-react';

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

  const currentMember = currentUserDni ? members.find((m) => m.dni === currentUserDni) : null;

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
    </div>
  );
};
