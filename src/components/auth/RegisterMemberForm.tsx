import React, { useState } from 'react';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import { registerMemberByWeb, authErrorMessage } from '../../lib/authService';
import { Alert, Button, Field, Input } from '../ui';

export interface RegisterMemberFormProps {
  localName: string;
  /** Se llama cuando la cuenta quedó creada con sesión abierta. */
  onRegistered: () => Promise<void> | void;
}

/**
 * Alta de socio desde el link del local. Crea la cuenta; el vínculo con el
 * local (y el control de cupo) lo hace la página con join_local().
 */
export const RegisterMemberForm: React.FC<RegisterMemberFormProps> = ({ localName, onRegistered }) => {
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = fullName.trim();
    const cleanDni = dni.replace(/\D/g, '');
    const cleanEmail = email.trim();

    if (!name || !cleanDni || !cleanEmail || !password) {
      setError('Completá nombre, DNI, email y contraseña.');
      return;
    }
    if (cleanDni.length < 7 || cleanDni.length > 9) {
      setError('Revisá el DNI: tiene que tener entre 7 y 9 números.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const authData = await registerMemberByWeb({
        fullName: name,
        dni: cleanDni,
        phone: phone.trim() || undefined,
        email: cleanEmail,
        password,
      });

      if (authData.session) {
        await onRegistered();
      } else {
        setPendingConfirmation(true);
      }
    } catch (err) {
      setError(authErrorMessage(err, 'No pudimos crear tu cuenta. Probá de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div
        role="status"
        className="bg-status-ok-soft border border-status-ok-border rounded-xl p-4 flex items-start gap-3"
      >
        <CheckCircle2 className="w-5 h-5 text-status-ok shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-text-primary">Revisá tu email</p>
          <p className="text-[13px] text-text-secondary leading-snug">
            Te mandamos un link para confirmar tu cuenta. Después volvé a esta página, ingresá y
            tocá «Sumarme a {localName}».
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
      {error && <Alert>{error}</Alert>}

      <Field label="Nombre y apellido" htmlFor="reg-name">
        <Input
          id="reg-name"
          variant="portal"
          autoComplete="name"
          placeholder="Ana Pérez"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Número de DNI" htmlFor="reg-dni">
        <Input
          id="reg-dni"
          variant="portal"
          mono
          inputMode="numeric"
          placeholder="43928104"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Teléfono" hint="Opcional" htmlFor="reg-phone">
        <Input
          id="reg-phone"
          variant="portal"
          mono
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="381 555 1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </Field>

      <Field label="Email" htmlFor="reg-email">
        <Input
          id="reg-email"
          variant="portal"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </Field>

      <Field label="Contraseña" hint="Mínimo 6 caracteres" htmlFor="reg-password">
        <Input
          id="reg-password"
          variant="portal"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          minLength={6}
          required
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        icon={UserPlus}
        loading={loading}
        className="w-full h-[54px]"
      >
        Crear cuenta y sumarme
      </Button>
    </form>
  );
};
